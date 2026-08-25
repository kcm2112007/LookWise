/* ============================================================
   LookScore — app logic
   Handles: upload, client-side quality checks, calling Claude's
   vision API for analysis, and rendering the consultation report.

   ⚠️ DEPLOYMENT NOTE (read before pushing this to GitHub Pages):
   The fetch() below calls https://api.anthropic.com directly from
   the browser. That only works inside Claude's own artifact
   sandbox, which proxies the request and injects credentials for
   you. On a plain static site (GitHub Pages, Netlify, etc.) this
   call will fail, because:
     1) Anthropic's API blocks direct browser calls (no CORS from
        arbitrary origins), and
     2) you should never ship an API key inside public client-side
        JS anyway — anyone could copy it and run up your bill.
   To make this work once it's live, put a tiny backend in front of
   it (a Cloudflare Worker, Vercel/Netlify serverless function, or
   any small server) that: receives the image from this frontend,
   calls the Anthropic API server-side with your key from an
   environment variable, and returns the JSON back to this page.
   Then just change the URL in runAnalysis() below to point at your
   own endpoint instead of api.anthropic.com directly.
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
    analysis: null,
    checkedPlanItems: {}
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

  function resetUpload(){
    state.file = null; state.dataUrl = null; state.quality = null;
    $('previewBlock').classList.add('hidden');
    $('qualityList').classList.add('hidden');
    $('qualityBanner').classList.add('hidden');
    $('qualityChecking').classList.remove('hidden');
    $('btnAnalyzeGo').disabled = true;
  }

  /* ---------------- client-side quality check ---------------- */
  function runQualityCheck(dataUrl){
    $('qualityChecking').classList.remove('hidden');
    $('qualityList').classList.add('hidden');
    $('qualityBanner').classList.add('hidden');
    $('btnAnalyzeGo').disabled = true;

    const img = new Image();
    img.onload = ()=>{
      const issues = [];
      const notes = [];

      // resolution
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      if(minDim < 300){
        issues.push('Resolution is quite low — details like skin and hair texture may be hard to assess.');
      } else {
        notes.push('Resolution looks sufficient.');
      }

      // downscale to canvas for brightness/blur estimate
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

        // rough Laplacian variance for blur estimate
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
        sharpness = variance; // higher = sharper
      }catch(e){ /* canvas read may fail in rare cases; skip silently */ }

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
        notes.push('Image looks sharp enough to review.');
      }

      state.quality = { issues, notes, minDim, brightness, sharpness };
      renderQuality();
    };
    img.onerror = ()=>{
      state.quality = { issues:['We couldn\'t read this image properly. Please try a different photo.'], notes:[] };
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
    if(q.issues.length >= 2){
      banner.className = 'banner banner-warn';
      banner.textContent = 'This photo has a few quality issues. You can still analyze it, but a clearer photo will give you better notes. Consider replacing it.';
      banner.classList.remove('hidden');
    } else if(q.issues.length === 1){
      banner.className = 'banner banner-info';
      banner.textContent = 'One quality note above — analysis will still work, results may just be a bit limited.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
    $('btnAnalyzeGo').disabled = false;
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  $('btnAnalyzeGo').addEventListener('click', startAnalysis);
  $('btnRetryAnalyze').addEventListener('click', startAnalysis);
  $('btnBackFromError').addEventListener('click', ()=> showScreen('screen-upload'));
  $('btnNewPhoto').addEventListener('click', ()=>{ resetUpload(); showScreen('screen-upload'); });
  $('btnDeleteFromResults').addEventListener('click', deleteAllData);

  /* ---------------- analysis ---------------- */
  const STAGE_MS = 900;
  let stageTimer = null;

  function startAnalysis(){
    showScreen('screen-analyzing');
    $('analyzingImg').src = state.dataUrl;
    $('analyzeErrorBlock').classList.add('hidden');
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
      }
    }, STAGE_MS);

    runAnalysis().then(result=>{
      clearInterval(stageTimer);
      stages.forEach(li=>{ li.classList.remove('active'); li.classList.add('done'); li.querySelector('.mark').textContent='✓'; });
      setTimeout(()=>{
        state.analysis = result;
        renderResults(result);
        showScreen('screen-results');
      }, 350);
    }).catch(err=>{
      clearInterval(stageTimer);
      $('analyzeErrorBlock').classList.remove('hidden');
      $('analyzeErrorMsg').textContent = err.message || 'Something went wrong during analysis. Please try again.';
    });
  }

  const ANALYSIS_PROMPT = `You are a respectful, practical personal style and grooming consultant reviewing ONE user-submitted photo.

Follow these rules strictly:
- Never mention or infer race, ethnicity, religion, disability, or any other protected characteristic.
- Never diagnose medical or skin conditions (e.g. do not say "acne", "eczema", "rosacea") — describe only general visible presentation like "some visible texture" or "appears to have some shine".
- Never comment on body weight, body shape, or attractiveness. Do not rate or score attractiveness or human worth in any way.
- Do not produce any numeric score of any kind.
- Be encouraging, specific, and realistic. Avoid insulting language ("ugly", "bad face", "needs surgery"). Frame improvement areas as opportunities, not flaws.
- Base every observation only on what is visibly present in the photo. If something isn't visible (e.g. clothing is cropped out, or facial hair isn't present), say so and skip forcing a comment.
- If the photo is unusable (no face clearly visible, extremely blurry/dark, or multiple faces making it ambiguous whose face to analyze), set "quality_ok" to false, explain why in "quality_issues", and leave other fields as reasonably empty arrays/objects — do not invent analysis for a photo you can't actually assess.

Return ONLY a single valid JSON object, with no markdown fences, no preamble, and no text outside the JSON. Use exactly this shape:

{
  "quality_ok": boolean,
  "quality_issues": [string],
  "categories": {
    "grooming": {"working": [string], "improve": [string], "action": string},
    "hair": {"working": [string], "improve": [string], "action": string},
    "skin": {"working": [string], "improve": [string], "action": string},
    "style": {"working": [string], "improve": [string], "action": string},
    "photo": {"working": [string], "improve": [string], "action": string}
  },
  "hairstyle_recommendations": [
    {"name": string, "why": string, "maintenance": "Low"|"Medium"|"High", "difficulty": "Easy"|"Moderate"|"Involved", "barber_request": string}
  ],
  "grooming_guide": {
    "hair": string, "eyebrows": string, "facial_hair": string, "hygiene": string, "nails": string, "fragrance": string
  },
  "skincare_guidance": {
    "morning": [string], "night": [string]
  },
  "style_recommendations": {
    "keep": [string], "improve": [string], "try_next": string
  },
  "photo_tips": [string],
  "priority_actions": [
    {"title": string, "why": string, "how_to": string, "effort": "Easy"|"Moderate"|"Involved", "impact": "High"|"Medium"}
  ]
}

Provide 3 to 5 items in "priority_actions", ordered by impact-to-effort ratio (best first). Provide 2 to 4 items in "hairstyle_recommendations" only if hair is visible enough to assess; otherwise return an empty array and explain briefly in the "hair" category's "improve" field that hair wasn't clearly visible. Keep every string concise (roughly one to three sentences) and written in a warm, professional, consultant voice.`;

  async function runAnalysis(){
    if(!state.quality || (state.quality.minDim && state.quality.minDim < 120)){
      throw new Error('This photo is too small to analyze reliably. Please upload a clearer, higher-resolution photo.');
    }

    const base64 = state.dataUrl.split(',')[1];
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 55000);

    let response;
    try{
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2200,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: state.mediaType, data: base64 } },
              { type: "text", text: ANALYSIS_PROMPT }
            ]
          }]
        })
      });
    } catch(e){
      clearTimeout(timeout);
      if(e.name === 'AbortError'){
        throw new Error('The analysis took too long and timed out. Please check your connection and try again.');
      }
      throw new Error('We couldn\'t reach the analysis service. Please check your connection and try again.');
    }
    clearTimeout(timeout);

    if(!response.ok){
      if(response.status === 429){
        throw new Error('The analysis service is busy right now. Please wait a moment and try again.');
      }
      throw new Error('The analysis service returned an error (status ' + response.status + '). Please try again.');
    }

    let data;
    try{ data = await response.json(); }
    catch(e){ throw new Error('We received an unreadable response from the analysis service. Please try again.'); }

    const textBlock = (data.content || []).find(c => c.type === 'text');
    if(!textBlock || !textBlock.text){
      throw new Error('The analysis service didn\'t return any results. Please try again.');
    }

    let raw = textBlock.text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/,'').replace(/```\s*$/,'');

    let parsed;
    try{ parsed = JSON.parse(raw); }
    catch(e){
      const match = raw.match(/\{[\s\S]*\}/);
      if(match){
        try{ parsed = JSON.parse(match[0]); } catch(e2){ /* fall through */ }
      }
      if(!parsed){
        throw new Error('We couldn\'t understand the analysis results. Please try again.');
      }
    }

    if(parsed.quality_ok === false){
      const reasons = (parsed.quality_issues && parsed.quality_issues.length)
        ? parsed.quality_issues.join(' ')
        : 'Your face wasn\'t clearly visible enough to analyze.';
      throw new Error(reasons + ' Please try a clearer, forward-facing photo.');
    }

    return normalizeResult(parsed);
  }

  function normalizeResult(p){
    const safe = (v, d) => (v === undefined || v === null) ? d : v;
    const cat = key => {
      const c = safe(p.categories && p.categories[key], {});
      return {
        working: safe(c.working, []),
        improve: safe(c.improve, []),
        action: safe(c.action, '')
      };
    };
    return {
      categories: {
        grooming: cat('grooming'),
        hair: cat('hair'),
        skin: cat('skin'),
        style: cat('style'),
        photo: cat('photo')
      },
      hairstyle_recommendations: safe(p.hairstyle_recommendations, []),
      grooming_guide: safe(p.grooming_guide, {}),
      skincare_guidance: {
        morning: safe(p.skincare_guidance && p.skincare_guidance.morning, ['Gentle cleanser','Moisturizer','Sunscreen (SPF 30+)']),
        night: safe(p.skincare_guidance && p.skincare_guidance.night, ['Gentle cleanser','Moisturizer'])
      },
      style_recommendations: {
        keep: safe(p.style_recommendations && p.style_recommendations.keep, []),
        improve: safe(p.style_recommendations && p.style_recommendations.improve, []),
        try_next: safe(p.style_recommendations && p.style_recommendations.try_next, '')
      },
      photo_tips: safe(p.photo_tips, []),
      priority_actions: safe(p.priority_actions, []).slice(0,5)
    };
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
    renderHairstyles(r.hairstyle_recommendations, r.categories.hair);
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
      el.innerHTML = '<p class="section-sub">No specific priorities were identified from this photo.</p>';
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

  function renderHairstyles(list, hairCat){
    const el = $('hairScroll');
    el.innerHTML = '';
    if(!list || !list.length){
      const msg = (hairCat && hairCat.improve && hairCat.improve.length) ? hairCat.improve.join(' ') : 'Hair wasn\'t clearly visible enough in this photo to suggest specific styles.';
      el.innerHTML = `<div class="banner banner-info" style="flex:1;">${escapeHtml(msg)}</div>`;
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
      <div class="style-col next"><h4>Try next</h4><p style="font-size:.85rem;margin:0;">${escapeHtml(s.try_next || 'No specific suggestion — clothing wasn\'t clearly visible.')}</p></div>
    `;
  }

  function renderGroomingGuide(g){
    const rows = [
      ['Hair', g.hair], ['Eyebrows', g.eyebrows], ['Facial hair', g.facial_hair],
      ['Hygiene', g.hygiene], ['Nails', g.nails], ['Fragrance', g.fragrance]
    ].filter(([,v]) => v);
    const el = $('groomingGuideCard');
    if(!rows.length){
      el.innerHTML = '<p style="color:var(--ink-soft);font-size:.87rem;">No additional grooming notes for this photo.</p>';
      return;
    }
    el.innerHTML = rows.map(([label,val])=>`
      <div style="padding:10px 0;border-bottom:1px solid var(--line);">
        <strong style="font-family:var(--serif);">${label}</strong>
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
      'Choose an uncluttered background so attention stays on you.',
      'Clean your camera lens before shooting.'
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
    state.analysis = null;
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
    resetUpload();
    toast('Your photo and results have been deleted from this session.');
    showScreen('screen-home');
  }

})();