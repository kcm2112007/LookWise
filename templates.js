/**
 * LookScore's "knowledge base" — no AI, no API.
 * Each template is a pre-written consultation tagged with the traits
 * it matches. The matching engine in script.js scores these against
 * the user's quiz answers and picks the closest one.
 *
 * To add more coverage: ask ChatGPT (or write by hand) more objects
 * in this exact shape, tag them with hair_length / hair_texture /
 * style_context, and push them into this array. More templates =
 * better matches, since right now anything that doesn't fit one of
 * these 4 profiles just gets the closest available guess.
 */
window.LOOKSCORE_TEMPLATES = [
  {
    "id": "short_straight_casual",
    "tags": { "hair_length": "short", "hair_texture": "straight", "style_context": "casual" },
    "data": {
      "categories": {
        "grooming": {"working": ["Overall grooming looks consistent and intentional", "Facial hair appears neatly maintained"], "improve": ["Eyebrow edges could be cleaned up slightly", "A more consistent fragrance routine could add polish"], "action": "Keep the current grooming routine and add a quick weekly eyebrow and facial-hair cleanup."},
        "hair": {"working": ["Short straight hair has a clean, easy-to-manage shape", "Natural texture adds subtle definition"], "improve": ["The sides could be kept slightly tighter", "A small amount of lightweight styling product could improve shape"], "action": "Ask for a clean taper around the sides and use a small amount of matte styling cream."},
        "skin": {"working": ["Skin appears generally cared for", "Natural skin texture looks realistic and healthy"], "improve": ["Some visible texture could be softened with a consistent routine", "The T-zone appears slightly more reflective"], "action": "Use a gentle cleanser, lightweight moisturizer, and daily sunscreen."},
        "style": {"working": ["Simple casual pieces create an approachable look", "The overall outfit appears comfortable and practical"], "improve": ["Better coordination between colors would make outfits feel more intentional", "Cleaner-fitting basics could improve consistency"], "action": "Build outfits around two neutral colors with one subtle accent."},
        "photo": {"working": ["The face is clearly visible", "Framing is straightforward and easy to assess"], "improve": ["Lighting is slightly uneven across the face", "A camera position closer to eye level would be more balanced"], "action": "Face a window for soft natural light and position the camera at eye level."}
      },
      "hairstyle_recommendations": [
        {"name": "Low Taper with Textured Top", "why": "Keeps the short shape clean while allowing natural texture on top.", "maintenance": "Low", "difficulty": "Easy", "barber_request": "Low taper on the sides and back, keep moderate length on top and add light texture."},
        {"name": "Classic Side Part", "why": "Adds structure without requiring a major change in length.", "maintenance": "Medium", "difficulty": "Easy", "barber_request": "Keep the top long enough for a natural side part with a subtle taper around the sides."}
      ],
      "grooming_guide": {"hair": "Wash according to scalp needs and use a small amount of lightweight styling product when needed.", "eyebrows": "Remove only obvious stray hairs and preserve the natural shape.", "facial_hair": "Keep the neckline and cheek edges tidy with regular trimming.", "hygiene": "Maintain a consistent shower, oral-care, and clean-clothing routine.", "nails": "Trim nails regularly and keep the edges smooth.", "fragrance": "Use a light everyday fragrance on clean skin, focusing on pulse points."},
      "skincare_guidance": {"morning": ["Gentle cleanser", "Lightweight moisturizer", "Broad-spectrum sunscreen"], "night": ["Gentle cleanser", "Simple moisturizer"]},
      "style_recommendations": {"keep": ["Neutral-colored basics", "Clean casual silhouettes"], "improve": ["Prioritize consistent sizing and fit", "Coordinate shoes with the overall color palette"], "try_next": "Try a neutral overshirt layered over a plain T-shirt with clean sneakers."},
      "photo_tips": ["Use soft window light rather than overhead lighting.", "Keep the camera around eye level.", "Leave a little space above the head while keeping the face prominent."],
      "priority_actions": [
        {"title": "Improve photo lighting", "why": "Better lighting makes grooming and styling details easier to assess.", "how_to": "Take photos facing a bright window with the light coming from slightly in front.", "effort": "Easy", "impact": "High"},
        {"title": "Refine the haircut", "why": "A cleaner taper will make the short hairstyle look more intentional.", "how_to": "Ask the barber for a low taper and light texture on top.", "effort": "Easy", "impact": "High"},
        {"title": "Standardize skincare", "why": "Consistency can help the skin look more balanced over time.", "how_to": "Follow the same gentle morning and evening routine each day.", "effort": "Easy", "impact": "Medium"}
      ]
    }
  },
  {
    "id": "long_straight_casual",
    "tags": { "hair_length": "long", "hair_texture": "straight", "style_context": "casual" },
    "data": {
      "categories": {
        "grooming": {"working": ["The basic grooming foundation is present", "Facial hair is kept relatively short"], "improve": ["Facial-hair edges are somewhat inconsistent", "Nails and eyebrow cleanup could be more regular"], "action": "Create a simple weekly maintenance routine covering facial hair, eyebrows, and nails."},
        "hair": {"working": ["Long straight hair provides plenty of styling flexibility", "The natural length gives the look a relaxed character"], "improve": ["Ends could be maintained more consistently", "The hair would benefit from more deliberate shaping around the face"], "action": "Ask for a light trim with face-framing layers while preserving overall length."},
        "skin": {"working": ["Skin has a natural appearance", "The routine does not appear overly complicated"], "improve": ["Some uneven texture is visible", "The skin could benefit from more consistent hydration"], "action": "Keep the routine simple with gentle cleansing, moisturizer, and daily sunscreen."},
        "style": {"working": ["Relaxed clothing works naturally with the longer hairstyle", "The casual direction feels cohesive"], "improve": ["Layering could create more visual structure", "Accessories could be used more intentionally"], "action": "Add one structured layer such as an overshirt, lightweight jacket, or cardigan."},
        "photo": {"working": ["The image has enough detail to understand the hairstyle", "The framing shows the overall hair shape"], "improve": ["The background is somewhat distracting", "The face is slightly turned away from the camera"], "action": "Use a cleaner background and face the camera more directly."}
      },
      "hairstyle_recommendations": [
        {"name": "Layered Medium-Length Flow", "why": "Preserves length while giving straight hair more movement and shape.", "maintenance": "Medium", "difficulty": "Moderate", "barber_request": "Keep the overall length, add subtle layers and light face-framing pieces without removing too much bulk."},
        {"name": "Long Middle Part", "why": "Works naturally with longer straight hair and creates a relaxed, balanced silhouette.", "maintenance": "Medium", "difficulty": "Easy", "barber_request": "Maintain the length, clean the ends, and create a soft middle part with minimal layering."}
      ],
      "grooming_guide": {"hair": "Use conditioner regularly and trim the ends periodically to maintain a clean shape.", "eyebrows": "Clean obvious stray hairs without making the brows overly defined.", "facial_hair": "Choose either a clean shave or a deliberately even short trim and maintain the edges.", "hygiene": "Keep a consistent shower, oral-care, and clean-clothing routine.", "nails": "Trim and file nails once a week or whenever edges become uneven.", "fragrance": "Choose one subtle everyday scent and use a few sprays rather than overspraying."},
      "skincare_guidance": {"morning": ["Gentle cleanser or water rinse", "Light moisturizer", "Broad-spectrum sunscreen"], "night": ["Gentle cleanser", "Moisturizer"]},
      "style_recommendations": {"keep": ["Relaxed casual pieces", "Comfortable neutral basics"], "improve": ["Add structured layers", "Pay more attention to shoe and accessory coordination"], "try_next": "Try a relaxed monochrome outfit with a structured overshirt and simple accessories."},
      "photo_tips": ["Choose a plain background so the hairstyle remains the focus.", "Face the camera directly for a clearer reference image.", "Use natural light from the front or slightly to one side."],
      "priority_actions": [
        {"title": "Shape the long hair", "why": "Subtle layering will make the length look more deliberate without losing the relaxed character.", "how_to": "Request a light trim with soft face-framing layers.", "effort": "Moderate", "impact": "High"},
        {"title": "Create a weekly grooming check", "why": "Regular small maintenance prevents an inconsistent appearance.", "how_to": "Set one weekly day for nails, eyebrow stray hairs, and facial-hair edges.", "effort": "Easy", "impact": "High"},
        {"title": "Improve outfit structure", "why": "A structured layer can make relaxed clothing look more intentional.", "how_to": "Add an overshirt, cardigan, or lightweight jacket over simple basics.", "effort": "Easy", "impact": "Medium"}
      ]
    }
  },
  {
    "id": "curly_casual",
    "tags": { "hair_length": "medium", "hair_texture": "curly", "style_context": "casual" },
    "data": {
      "categories": {
        "grooming": {"working": ["The grooming approach is simple and low-maintenance", "The overall presentation is clean"], "improve": ["Eyebrows could use minor cleanup", "Facial-hair maintenance appears slightly overdue"], "action": "Use a short weekly grooming session to keep small details consistent."},
        "hair": {"working": ["Natural curls provide strong texture and movement", "The hairstyle has visible volume"], "improve": ["Curl definition could be more consistent", "The sides and neckline could be shaped more cleanly"], "action": "Ask for a shape-up that preserves curl volume and use a lightweight curl cream."},
        "skin": {"working": ["Skin appears naturally hydrated", "The overall routine looks uncomplicated"], "improve": ["Some visible texture is present around the face", "A more consistent moisturizing routine could improve comfort and appearance"], "action": "Use gentle products and avoid over-cleansing or excessive scrubbing."},
        "style": {"working": ["The casual direction works well with the textured hairstyle", "Simple pieces keep the look easygoing"], "improve": ["Outfit proportions could be more deliberate", "A stronger color combination would create more cohesion"], "action": "Pair relaxed pieces with one cleaner, structured item."},
        "photo": {"working": ["The image captures the natural curl pattern clearly", "The hairstyle is visible from the front"], "improve": ["The overhead light creates some harsh shadows", "The camera angle is slightly below eye level"], "action": "Use front-facing window light and raise the camera to eye level."}
      },
      "hairstyle_recommendations": [
        {"name": "Curly Taper", "why": "Keeps the natural curl volume while creating a cleaner outline around the sides and neckline.", "maintenance": "Medium", "difficulty": "Moderate", "barber_request": "Keep the curls full on top, taper the sides and neckline gently, and avoid removing too much length."},
        {"name": "Defined Curly Crop", "why": "A shorter shape makes curls easier to manage while retaining natural texture.", "maintenance": "Medium", "difficulty": "Easy", "barber_request": "Create a short rounded shape on top with a soft taper and preserve natural curl definition."}
      ],
      "grooming_guide": {"hair": "Use a gentle cleanser when needed, condition regularly, and apply a small amount of curl cream to damp hair.", "eyebrows": "Remove only obvious stray hairs and keep the natural brow thickness.", "facial_hair": "Trim consistently and keep the neckline clean.", "hygiene": "Maintain regular showering, oral care, and fresh clothing.", "nails": "Keep nails short, clean, and smoothly filed.", "fragrance": "Choose a fresh everyday fragrance and apply lightly."},
      "skincare_guidance": {"morning": ["Gentle cleanser", "Light moisturizer", "Broad-spectrum sunscreen"], "night": ["Gentle cleanser", "Moisturizer"]},
      "style_recommendations": {"keep": ["Relaxed casual clothing", "Simple everyday basics"], "improve": ["Experiment with cleaner proportions", "Coordinate one accent color with neutral pieces"], "try_next": "Try relaxed trousers with a fitted plain top and a structured overshirt."},
      "photo_tips": ["Avoid direct overhead lighting because it can create strong shadows.", "Raise the camera to approximately eye level.", "Use a neutral background and keep the hair fully inside the frame."],
      "priority_actions": [
        {"title": "Shape the curls", "why": "A cleaner outline will make the natural curl pattern look more intentional.", "how_to": "Request a gentle taper while keeping the curl volume on top.", "effort": "Moderate", "impact": "High"},
        {"title": "Fix photo lighting", "why": "Soft front lighting will show the hair and grooming details more accurately.", "how_to": "Stand facing a bright window and avoid strong overhead lights.", "effort": "Easy", "impact": "High"},
        {"title": "Use consistent curl styling", "why": "A repeatable routine makes textured hair easier to manage.", "how_to": "Apply a small amount of curl cream to damp hair and let it dry without excessive handling.", "effort": "Easy", "impact": "Medium"}
      ]
    }
  },
  {
    "id": "textured_formal",
    "tags": { "hair_length": "short", "hair_texture": "textured", "style_context": "formal" },
    "data": {
      "categories": {
        "grooming": {"working": ["The overall grooming is neat and deliberate", "Facial-hair edges appear well maintained"], "improve": ["The routine could include more regular nail care", "A slightly more subtle fragrance approach would improve balance"], "action": "Maintain the current grooming standard and add a fixed weekly nail-care routine."},
        "hair": {"working": ["The textured hairstyle has a strong defined shape", "The top has enough length for versatile styling"], "improve": ["The shape could be refreshed around the sides between haircuts", "Product buildup should be avoided"], "action": "Keep the current cut but schedule regular trims and use styling product sparingly."},
        "skin": {"working": ["Skin appears well cared for", "The overall surface looks reasonably balanced"], "improve": ["Some visible texture remains", "Daily sun protection should remain consistent"], "action": "Keep the existing simple routine and make sunscreen a daily habit."},
        "style": {"working": ["Formal clothing creates a polished and organized impression", "The pieces appear coordinated"], "improve": ["Small details such as accessories could be more intentional", "Shoe and belt coordination can be checked more consistently"], "action": "Use restrained accessories and match leather details when appropriate."},
        "photo": {"working": ["Lighting is even", "The camera angle is appropriate", "The face and hairstyle are clearly visible"], "improve": ["The background could be slightly simpler", "A little more space around the shoulders would improve framing"], "action": "Keep the current lighting and move slightly farther from the camera."}
      },
      "hairstyle_recommendations": [
        {"name": "Textured Ivy League", "why": "Keeps the polished character while adding controlled texture and flexibility.", "maintenance": "Medium", "difficulty": "Moderate", "barber_request": "Keep moderate length on top, add subtle texture, and taper the sides and back cleanly."},
        {"name": "Classic Taper", "why": "A timeless shape that works well with formal and smart-casual clothing.", "maintenance": "Low", "difficulty": "Easy", "barber_request": "Use a classic taper on the sides and back while keeping enough top length for natural styling."}
      ],
      "grooming_guide": {"hair": "Wash as needed and use a small amount of matte product to maintain the textured shape.", "eyebrows": "Keep the natural shape and remove only obvious stray hairs.", "facial_hair": "Maintain clean edges and consistent length.", "hygiene": "Continue regular showering, oral care, and clean clothing habits.", "nails": "Trim and file nails weekly, especially before formal occasions.", "fragrance": "Use a restrained amount of fragrance so it remains noticeable only at close range."},
      "skincare_guidance": {"morning": ["Gentle cleanser", "Moisturizer", "Broad-spectrum sunscreen"], "night": ["Gentle cleanser", "Moisturizer"]},
      "style_recommendations": {"keep": ["Structured formal pieces", "Coordinated neutral colors"], "improve": ["Refine accessory selection", "Check small details such as belt and shoe coordination"], "try_next": "Try a tailored smart-casual outfit combining a clean knit polo, structured trousers, and minimal leather accessories."},
      "photo_tips": ["Keep the camera around eye level.", "Use the existing even lighting setup.", "Choose a simple background with minimal visual distractions."],
      "priority_actions": [
        {"title": "Maintain the haircut shape", "why": "Regular trimming keeps a structured hairstyle looking intentional.", "how_to": "Schedule a light trim before the sides and neckline lose their shape.", "effort": "Easy", "impact": "High"},
        {"title": "Refine accessories", "why": "Small details can strengthen an already coordinated formal outfit.", "how_to": "Use one or two understated accessories and coordinate leather details when applicable.", "effort": "Easy", "impact": "Medium"},
        {"title": "Make sunscreen consistent", "why": "Daily sun protection is an important part of a basic grooming routine.", "how_to": "Apply broad-spectrum sunscreen every morning as the final skincare step.", "effort": "Easy", "impact": "Medium"}
      ]
    }
  }
];
