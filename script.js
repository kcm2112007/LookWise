/* ============================================================
   LookScore — app logic (fully offline, no API, no server)

   HOW THE "KNOWLEDGE" WORKS — read this before you extend it:
   This app does not use AI to look at your photo. It:
     1) asks 3 quick questions (hair length, hair texture, style),
     2) genuinely measures your photo's brightness/sharpness/size
        using real pixel math on a canvas (see runQualityCheck),
     3) picks the closest matching pre-written consultation from
        window.LOOKSCORE_TEMPLATES (see templates.js) based on your
        quiz answers,
     4) folds the REAL photo-quality findings from step 2 into that
        template's photo section and priorities.
   Steps 2 and 4 are genuinely derived from your photo. Steps 1 and 3
   are template matching, not photo analysis — the app tells the user
   this directly on the results screen, and you should keep that
   honest framing if you customize the copy.

   To add more coverage: add more objects to templates.js in the same
   shape, tagged with hair_length / hair_texture / style_context.
   ============================================================ */

(function(){
  "use strict";

  /* ---------------- state ---------------- */
  const state = {
    theme: 'light',
    file: null,
    dataUrl: null,
    mediaType: null,
    quality: null,
    hasPhoto: false,
    answers: { hair_length: null, hair_texture: null, style_context: null },
    result: null
  };

  /* ---------------- utils ---------------- */
  const $ = id => document.getElementById(id);
  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(()=>t.classList.remove('show'), 2600);
  }
  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');
    window.scrollTo({top:0, behavior:'instant' in window ? 'instant' : 'auto'});
  }
  document.querySelectorAll('[data-back]').forEach(btn=>{
    btn.addEventListener('click', ()=> showScreen(btn.dataset.back));
  });
  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------------- theme ---------------- */
  function applyTheme(t){
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
  $('themeToggle').addEventListener('click', ()=>{
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- home ---------------- */
  $('ctaAnalyze').addEventListener('click', ()=> showScreen('screen-upload'));
  $('ctaHow').addEventListener('click', ()=>{
    const el = $('howItWorks');
    el.classList.toggle('hidden');
    if(!el.classList.contains('hidden')) el.scrollIntoView({behavior:'smooth', block:'start'});
  });
  $('footerPrivacyLink').addEventListener('click', ()=> showScreen('screen-privacy'));
  $('btnDeleteAll').addEventListener('click', deleteAllData);

  /* ---------------- upload wiring ---------------- */
  const dropzone = $('dropzone');
  const fileInput = $('fileInput');
  const cameraInput = $('cameraInput');

  $('btnChooseFile').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  $('btnCamera').addEventListener('click', e => { e.stopPropagation(); cameraInput.click(); });
  dropzone.addEventListener('click', ()=> fileInput.click());
  dropzone.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); fileInput.click(); } });

  ['dragenter','dragover'].forEach(ev=>{
    dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add('drag'); });
  });
  ['dragleave','drop'].forEach(ev=>{
    dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove('drag'); });
  });
  dropzone.addEventListener('drop', e=>{
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(f) handleFile(f);
  });
  fileInput.addEventListener('change', e=>{
    if(e.target.files[0]) handleFile(e.target.files[0]);
    fileInput.value = '';
  });
  cameraInput.addEventListener('change', e=>{
    if(e.target.files[0]) handleFile(e.target.files[0]);
    cameraInput.value = '';
  });

  const ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp'];
  const MAX_BYTES = 10 * 1024 * 1024;

  function showUploadError(msg){
    const el = $('uploadError');
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function clearUploadError(){ $('uploadError').classList.add('hidden'); }

  function handleFile(file){
    clearUploadError();
    if(!ALLOWED_TYPES.includes(file.type)){
      showUploadError('That file type isn\'t supported. Please upload a JPG, PNG or WebP image.');
      return;
    }
    if(file.size > MAX_BYTES){
      showUploadError('That photo is larger than 10MB. Please upload a smaller file or a compressed photo.');
      return;
    }
    state.file = file;
    const reader = new FileReader();
    reader.onload = e=>{
      state.dataUrl = e.target.result;
      state.hasPhoto = true;
      state.mediaType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
      $('previewImg').src = state.dataUrl;
      $('previewBlock').classList.remove('hidden');
      $('previewBlock').scrollIntoView({behavior:'smooth', block:'nearest'});
      runQualityCheck(state.dataUrl);
    };
    reader.onerror = ()=> showUploadError('We couldn\'t read that file. Please try a different photo.');
    reader.readAsDataURL(file);
  }

  $('btnReplace').addEventListener('click', ()=> fileInput.click());
  $('btnRemove').addEventListener('click', resetUpload);
  $('btnSkipPhoto').addEventListener('click', ()=>{ resetUpload(); showScreen('screen-quiz'); });
  $('btnToQuiz').addEventListener('click', ()=> showScreen('screen-quiz'));

  function resetUpload(){
    state.file = null; state.dataUrl = null; state.quality = null; state.hasPhoto = false;
    $('previewBlock').classList.add('hidden');
    $('qualityList').classList.add('hidden');
    $('qualityBanner').classList.add('hidden');
    $('qualityChecking').classList.remove('hidden');
  }

  /* ---------------- client-side quality check (REAL, runs on actual pixels) ---------------- */
  function runQualityCheck(dataUrl){
    $('qualityChecking').classList.remove('hidden');
    $('qualityList').classList.add('hidden');
    $('qualityBanner').classList.add('hidden');

    const img = new Image();
    img.onload = ()=>{
      const issues = [];
      const notes = [];

      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      if(minDim < 300){
        issues.push('Resolution is quite low — hard to judge fine detail from this photo.');
      } else {
        notes.push('Resolution looks sufficient.');
      }

      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let brightness = 0.5, sharpness = 1;
      try{
        const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let sum = 0;
        const gray = new Float32Array(canvas.width*canvas.height);
        for(let i=0, p=0; i<data.length; i+=4, p++){
          const g = (data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114);
          gray[p] = g;
          sum += g;
        }
        brightness = sum / (canvas.width*canvas.height) / 255;

        let lapSum = 0, lapSumSq = 0, n = 0;
        const w = canvas.width, h = canvas.height;
        for(let y=1; y<h-1; y++){
          for(let x=1; x<w-1; x++){
            const idx = y*w+x;
            const lap = 4*gray[idx] - gray[idx-1] - gray[idx+1] - gray[idx-w] - gray[idx+w];
            lapSum += lap; lapSumSq += lap*lap; n++;
          }
        }
        const mean = lapSum/Math.max(1,n);
        const variance = (lapSumSq/Math.max(1,n)) - mean*mean;
        sharpness = variance;
      }catch(e){ /* canvas read may fail rarely; skip silently */ }

      if(brightness < 0.22){
        issues.push('Your photo looks a little dark. Try facing a window with even, natural light.');
      } else if(brightness > 0.88){
        issues.push('Your photo looks overexposed. Try softer, indirect lighting instead of direct sun or flash.');
      } else {
        notes.push('Lighting looks reasonably even.');
      }

      if(sharpness < 18){
        issues.push('The image may be slightly blurry. Hold the camera steady, or clean the lens, and try again.');
      } else {
        notes.push('Image looks sharp enough.');
      }

      state.quality = { issues, notes, minDim, brightness, sharpness };
      renderQuality();
    };
    img.onerror = ()=>{
      state.quality = { issues:['We couldn\'t read this image properly.'], notes:[] };
      renderQuality();
    };
    img.src = dataUrl;
  }

  function renderQuality(){
    $('qualityChecking').classList.add('hidden');
    const list = $('qualityList');
    list.innerHTML = '';
    const q = state.quality;

    q.notes.forEach(n=>{
      const li = document.createElement('li');
      li.className = 'quality-item';
      li.innerHTML = `<span class="qi-dot qi-ok">✓</span><span>${escapeHtml(n)}</span>`;
      list.appendChild(li);
    });
    q.issues.forEach(n=>{
      const li = document.createElement('li');
      li.className = 'quality-item';
      li.innerHTML = `<span class="qi-dot qi-warn">!</span><span>${escapeHtml(n)}</span>`;
      list.appendChild(li);
    });
    list.classList.remove('hidden');

    const banner = $('qualityBanner');
    if(q.issues.length >= 1){
      banner.className = 'banner banner-info';
      banner.textContent = 'Noted — these real findings will be added to your results.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  /* ---------------- quiz ---------------- */
  document.querySelectorAll('.quiz-options').forEach(group=>{
    const question = group.dataset.question;
    group.querySelectorAll('.quiz-option').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        group.querySelectorAll('.quiz-option').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        state.answers[question] = btn.dataset.value;
        updateQuizButton();
      });
    });
  });
  function updateQuizButton(){
    const done = state.answers.hair_length && state.answers.hair_texture && state.answers.style_context;
    $('btnGetNotes').disabled = !done;
  }
  $('btnGetNotes').addEventListener('click', startMatching);
  $('btnNewPhoto').addEventListener('click', ()=>{
    resetUpload();
    state.answers = { hair_length: null, hair_texture: null, style_context: null };
    document.querySelectorAll('.quiz-option.selected').forEach(b=>b.classList.remove('selected'));
    $('btnGetNotes').disabled = true;
    showScreen('screen-home');
  });
  $('btnDeleteFromResults').addEventListener('click', deleteAllData);

  /* ---------------- matching engine (the "brain") ---------------- */
  function scoreTemplate(templateTags, answers){
    let score = 0;
    for(const key in templateTags){
      if(answers[key] && answers[key] === templateTags[key]) score++;
    }
    return score;
  }

  function pickBestTemplate(answers){
    const templates = window.LOOKSCORE_TEMPLATES || [];
    let best = null, bestScore = -1;
    templates.forEach(t=>{
      const s = scoreTemplate(t.tags, answers);
      if(s > bestScore){ bestScore = s; best = t; }
    });
    return { template: best, score: bestScore };
  }

  function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function buildResult(answers, qualityIssues){
    const { template } = pickBestTemplate(answers);
    const result = deepClone(template.data);

    if(qualityIssues && qualityIssues.length){
      result.categories.photo.improve = Array.from(new Set([...qualityIssues, ...result.categories.photo.improve]));
      result.photo_tips = Array.from(new Set([...qualityIssues, ...result.photo_tips]));
      result.priority_actions.unshift({
        title: "Fix photo quality first",
        why: "Your uploaded photo had real, detected lighting or sharpness issues.",
        how_to: qualityIssues.join(' '),
        effort: "Easy",
        impact: "High"
      });
      result.priority_actions = result.priority_actions.slice(0,5);
    }
    return result;
  }

  /* ---------------- "analyzing" transition (honest — just paced UX) ---------------- */
  const STAGE_MS = 550;
  let stageTimer = null;

  function startMatching(){
    showScreen('screen-analyzing');
    const photoWrap = $('analyzingPhotoWrap');
    if(state.hasPhoto && state.dataUrl){
      $('analyzingImg').src = state.dataUrl;
      photoWrap.classList.remove('hidden');
    } else {
      photoWrap.classList.add('hidden');
    }

    document.querySelectorAll('#stageList li').forEach(li=>{
      li.classList.remove('active','done');
      li.querySelector('.mark').textContent = '·';
    });
    let stage = 0;
    const stages = document.querySelectorAll('#stageList li');
    stages[0].classList.add('active');
    stages[0].querySelector('.mark').textContent = '›';

    clearInterval(stageTimer);
    stageTimer = setInterval(()=>{
      if(stage < stages.length - 1){
        stages[stage].classList.remove('active');
        stages[stage].classList.add('done');
        stages[stage].querySelector('.mark').textContent = '✓';
        stage++;
        stages[stage].classList.add('active');
        stages[stage].querySelector('.mark').textContent = '›';
      } else {
        clearInterval(stageTimer);
        stages[stage].classList.remove('active');
        stages[stage].classList.add('done');
        stages[stage].querySelector('.mark').textContent = '✓';
        finishMatching();
      }
    }, STAGE_MS);
  }

  function finishMatching(){
    const qualityIssues = (state.quality && state.quality.issues) ? state.quality.issues : [];
    const result = buildResult(state.answers, qualityIssues);
    state.result = result;
    setTimeout(()=>{
      renderResults(result);
      showScreen('screen-results');
    }, 300);
  }

  /* ---------------- render results ---------------- */
  const CAT_META = {
    grooming: {label:'Grooming', icon:'✂'},
    hair: {label:'Hair', icon:'✦'},
    skin: {label:'Skin presentation', icon:'◐'},
    style: {label:'Style', icon:'▢'},
    photo: {label:'Photo quality', icon:'◎'}
  };

  function renderResults(r){
    renderPriorities(r.priority_actions);
    renderCategories(r.categories);
    renderHairstyles(r.hairstyle_recommendations);
    renderStyle(r.style_recommendations);
    renderGroomingGuide(r.grooming_guide);
    renderSkincare(r.skincare_guidance);
    renderPhotoTips(r.photo_tips);
    renderPlan(r.priority_actions);
  }

  function renderPriorities(list){
    const el = $('priorityStack');
    el.innerHTML = '';
    if(!list.length){
      el.innerHTML = '<p class="section-sub">No specific priorities were identified.</p>';
      return;
    }
    list.forEach((item, i)=>{
      const div = document.createElement('div');
      div.className = 'priority-card';
      div.innerHTML = `
        <div class="priority-num">${String(i+1).padStart(2,'0')}</div>
        <div class="priority-body">
          <h3>${escapeHtml(item.title||'')}</h3>
          <p class="why">${escapeHtml(item.why||'')}</p>
          <p class="how"><strong>How:</strong> ${escapeHtml(item.how_to||'')}</p>
          <div class="chip-row">
            <span class="chip ${/high/i.test(item.impact)?'chip-impact-high':''}">${escapeHtml(item.impact||'Impact')} impact</span>
            <span class="chip ${/easy/i.test(item.effort)?'chip-effort-easy':''}">${escapeHtml(item.effort||'Effort')} effort</span>
          </div>
        </div>`;
      el.appendChild(div);
    });
  }

  function listBlock(arr){
    if(!arr || !arr.length) return '<p style="color:var(--ink-soft);font-size:.85rem;margin:0;">Nothing specific noted.</p>';
    return '<ul>' + arr.map(a=>`<li>${escapeHtml(a)}</li>`).join('') + '</ul>';
  }

  function renderCategories(categories){
    const el = $('categoryCards');
    el.innerHTML = '';
    Object.keys(CAT_META).forEach(key=>{
      const c = categories[key] || {working:[],improve:[],action:''};
      const meta = CAT_META[key];
      const card = document.createElement('div');
      card.className = 'cat-card';
      card.innerHTML = `
        <div class="cat-head"><div class="cat-icon">${meta.icon}</div><h3>${meta.label}</h3></div>
        <div class="cat-cols">
          <div class="cat-col working"><h4>Working well</h4>${listBlock(c.working)}</div>
          <div class="cat-col improve"><h4>Worth adjusting</h4>${listBlock(c.improve)}</div>
        </div>
        ${c.action ? `<div class="cat-action">Try: <strong>${escapeHtml(c.action)}</strong></div>` : ''}
      `;
      el.appendChild(card);
    });
  }

  function renderHairstyles(list){
    const el = $('hairScroll');
    el.innerHTML = '';
    if(!list || !list.length){
      el.innerHTML = `<div class="banner banner-info" style="flex:1;">No hairstyle matches for this combination yet.</div>`;
      return;
    }
    list.forEach(h=>{
      const card = document.createElement('div');
      card.className = 'hair-card';
      card.innerHTML = `
        <h4>${escapeHtml(h.name||'')}</h4>
        <p>${escapeHtml(h.why||'')}</p>
        ${h.barber_request ? `<div class="barber">Ask your barber: "${escapeHtml(h.barber_request)}"</div>` : ''}
        <div class="hair-meta"><span>Maint: ${escapeHtml(h.maintenance||'—')}</span><span>·</span><span>${escapeHtml(h.difficulty||'—')}</span></div>
      `;
      el.appendChild(card);
    });
  }

  function renderStyle(s){
    const el = $('styleGrid');
    el.innerHTML = `
      <div class="style-col keep"><h4>Keep</h4>${listBlock(s.keep)}</div>
      <div class="style-col improve"><h4>Improve</h4>${listBlock(s.improve)}</div>
      <div class="style-col next"><h4>Try next</h4><p style="font-size:.85rem;margin:0;">${escapeHtml(s.try_next || 'No specific suggestion for this combination.')}</p></div>
    `;
  }

  function renderGroomingGuide(g){
    const rows = [
      ['Hair', g.hair], ['Eyebrows', g.eyebrows], ['Facial hair', g.facial_hair],
      ['Hygiene', g.hygiene], ['Nails', g.nails], ['Fragrance', g.fragrance]
    ].filter(([,v]) => v);
    const el = $('groomingGuideCard');
    if(!rows.length){
      el.innerHTML = '<p style="color:var(--ink-soft);font-size:.87rem;">No additional grooming notes.</p>';
      return;
    }
    el.innerHTML = rows.map(([label,val])=>`
      <div style="padding:10px 0;border-bottom:1px solid var(--border-soft);">
        <strong style="font-family:var(--display);">${label}</strong>
        <p style="margin:4px 0 0;font-size:.87rem;color:var(--ink-soft);">${escapeHtml(val)}</p>
      </div>`).join('');
  }

  function renderSkincare(s){
    const el = $('skincareGrid');
    el.innerHTML = `
      <div class="routine-col"><h4>Morning</h4><ol>${(s.morning||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol></div>
      <div class="routine-col"><h4>Night</h4><ol>${(s.night||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol></div>
    `;
  }

  function renderPhotoTips(tips){
    const el = $('photoTipsList');
    const base = tips && tips.length ? tips : [
      'Use soft, natural light facing your face rather than behind you.',
      'Keep the camera around eye level rather than shooting up or down.',
      'Choose an uncluttered background so attention stays on you.'
    ];
    el.innerHTML = base.map(t=>`<li><span class="tip-mark">→</span><span>${escapeHtml(t)}</span></li>`).join('');
  }

  function renderPlan(priorities){
    const buckets = {quick: [], p7: [], p30: [], p90: []};
    priorities.forEach((p,i)=>{
      const item = {id:'plan-'+i, title:p.title, how:p.how_to};
      const easy = /easy/i.test(p.effort);
      const involved = /involved/i.test(p.effort);
      if(easy) buckets.quick.push(item);
      if(!involved) buckets.p7.push(item);
      buckets.p30.push(item);
      buckets.p90.push(item);
    });
    if(!buckets.quick.length && priorities.length) buckets.quick = buckets.p7.slice(0,2);

    Object.keys(buckets).forEach(key=>{
      const panel = $('plan-' + key);
      const items = buckets[key];
      if(!items.length){
        panel.innerHTML = '<p style="color:var(--ink-soft);font-size:.87rem;padding:10px 0;">Nothing scheduled in this window — check the other tabs.</p>';
        return;
      }
      panel.innerHTML = '<ul>' + items.map(it=>`
        <li>
          <span class="plan-check" data-id="${it.id}-${key}" role="checkbox" aria-checked="false" tabindex="0">✓</span>
          <span><strong>${escapeHtml(it.title)}</strong><br><span style="color:var(--ink-soft);">${escapeHtml(it.how||'')}</span></span>
        </li>`).join('') + '</ul>';
    });

    document.querySelectorAll('.plan-check').forEach(chk=>{
      const toggle = ()=>{
        chk.classList.toggle('checked');
        chk.setAttribute('aria-checked', chk.classList.contains('checked') ? 'true':'false');
      };
      chk.addEventListener('click', toggle);
      chk.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
    });
  }

  document.querySelectorAll('.plan-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.plan-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.plan-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      $('plan-' + tab.dataset.plan).classList.add('active');
    });
  });

  /* ---------------- delete data ---------------- */
  function deleteAllData(){
    state.file = null;
    state.dataUrl = null;
    state.mediaType = null;
    state.quality = null;
    state.hasPhoto = false;
    state.answers = { hair_length: null, hair_texture: null, style_context: null };
    state.result = null;
    $('previewImg').src = '';
    $('analyzingImg').src = '';
    $('priorityStack').innerHTML = '';
    $('categoryCards').innerHTML = '';
    $('hairScroll').innerHTML = '';
    $('styleGrid').innerHTML = '';
    $('groomingGuideCard').innerHTML = '';
    $('skincareGrid').innerHTML = '';
    $('photoTipsList').innerHTML = '';
    ['plan-quick','plan-p7','plan-p30','plan-p90'].forEach(id=> $(id).innerHTML = '');
    document.querySelectorAll('.quiz-option.selected').forEach(b=>b.classList.remove('selected'));
    $('btnGetNotes').disabled = true;
    resetUpload();
    toast('Your photo and answers have been deleted from this session.');
    showScreen('screen-home');
  }

})();
