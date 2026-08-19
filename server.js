import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors({
  exposedHeaders: ['X-Artist', 'X-Artist-Id', 'X-Kicks']
}));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { chatHistory, stats, activeCharacter, action, roll, inventory, hiddenStats, skills, currentEnemy, forceEncounter } = req.body;

    let enemyContext = "";
    if (currentEnemy) {
      enemyContext = `\nCOMBAT ACTIVE: The player is currently fighting ${currentEnemy.name}. Enemy Stats: HP ${currentEnemy.hp}/${currentEnemy.maxHp}, STR ${currentEnemy.str}, DEX ${currentEnemy.dex}, INT ${currentEnemy.int}, CHA ${currentEnemy.cha}.`;
    } else if (forceEncounter) {
      enemyContext = `\nA RANDOM ENEMY ENCOUNTER HAS BEEN TRIGGERED! You MUST output an 'enemySpawn' object initializing a new hostile enemy facing off against the player based on the current environment.`;
    }

    // Build the context string from history
    let historyContext = chatHistory.slice(-10).map(msg => `${msg.sender}: ${msg.text}`).join('\n');

    const prompt = `
You are the Game Master in a dark fantasy text-based RPG called 'Orsted Isles - Crown of dominions'. 
The player is controlling a character named ${activeCharacter.name}, a ${activeCharacter.charClass}.
Their core stats are: HP ${stats.HP}/20, STR ${stats.STR}, DEX ${stats.DEX}, INT ${stats.INT}, CHA ${stats.CHA}.
Their skills are: ${JSON.stringify(skills)}
Their hidden psychological/moral stats are: ${JSON.stringify(hiddenStats)}
Their backstory: "${activeCharacter.flavorText}"
Their current inventory: [${inventory.join(', ')}]
${enemyContext}

Recent chat history:
${historyContext}

The player has attempted an action: "${action}"
The system automatically rolled a base 1d20 for this action. The base roll is: ${roll}.

Rules for your response:
1. NEURAL WEIGHT ENGINE: Act as a neural network. Evaluate the action, determine which core stats, skills, and hidden stats apply. Calculate an 'effective roll' behind the scenes (e.g., if searching and Perception is high, treat a base 10 as a 14).
2. You must honor the EFFECTIVE dice roll outcome. 
   - 1-9: The action fails, usually resulting in a complication or damage.
   - 10-15: Standard success. The player accomplishes their goal. Do NOT punish the player or deal damage on a success unless the action itself is inherently self-destructive.
   - 16-20+: Critical success. You MUST reward the player with a major advantage (e.g., finding rare/valuable loot, dealing massive damage, uncovering a crucial secret, or gaining a significant buff).
3. Be atmospheric, dark, and descriptive. There is no strict length limit for your narrative—if the situation warrants it, give a large, detailed, and extensive reply. CRITICAL: You MUST conclusively resolve the action the player attempted. Do NOT just describe the "attempt" or "buildup"—tell the player exactly what the final outcome of their action was (e.g. if they attack, narrate the strike landing and the enemy's reaction/death).
4. CRITICAL: NEVER mention the words "roll", "stats", or any numbers related to the dice roll in your narrative. Do NOT say "Because of your low luck" or "The base roll of X". The narrative must be 100% immersive and in-universe. Do not break the fourth wall.
5. INVENTORY MANAGEMENT: If the narrative implies the player obtains, picks up, or steals a new item, you MUST add its name to the 'inventoryAdd' array. If an item breaks, is dropped, or is lost, add it to 'inventoryRemove'. CRITICAL: If you add or remove an item, you MUST explicitly narrate it (e.g. "you stash the cloak in your bag", "it shatters") so the player understands their inventory changed.
6. PLAYER HEALTH ONLY: 'hpChange' ONLY applies to the PLAYER'S HP. If the PLAYER gets hurt, output a negative number (e.g. -2). If the PLAYER heals, output a positive number. If the PLAYER deals damage to an ENEMY, DO NOT modify 'hpChange' (output 0). CRITICAL: Do NOT lower the player's HP unless they explicitly take physical damage or are attacked in the narrative text. Additionally, whenever the player takes damage, you MUST explicitly and stylishly narrate the physical toll it takes on their body (e.g., 'blood trickles down your arm', 'a sharp pain shoots through your ribs') so they know exactly why they lost health.
7. DEATH LOGIC: If the narrative dictates the player dies (or their HP will drop to 0), check their inventory. If they have a life-reviving item (like 'Health Potion', 'Phoenix Down', etc.), narrate the item automatically saving their life, add the item to 'inventoryRemove', and set 'isDead' to false. Otherwise, narrate their gruesome death and set 'isDead' to true.
8. DYNAMIC ALIGNMENT: If the character performs an action that violates or embraces a certain morality/psychological trait (e.g., a holy person doing evil, an act of sheer terror, an act of immense curiosity), shift their hidden stats. Output these shifts as an object in 'hiddenStatChanges' (e.g. {"Morality": -5, "Corruption": 5}). Only output shifts if they are highly significant.
9. SKILL TRIGGERS: If any of the player's passive or active skills actively influence the outcome of the action (e.g. saving their life, ensuring a success, granting an advantage), add the EXACT name of the skill to the 'skillsTriggered' array.
10. COMBAT SYSTEM: If the player is IN COMBAT, dictate damage dealt to the ENEMY by outputting a negative number for 'enemyHpChange'. If they kill the enemy, output enough negative enemyHpChange to drop the enemy's HP to 0. If a RANDOM ENCOUNTER was triggered, you MUST output an 'enemySpawn' object containing { "name": "...", "maxHp": number, "str": number, "dex": number, "int": number, "cha": number, "description": "..." }.
11. CURRENCY: The official currency of this world is 'Gold'. Whenever dealing with money, wealth, or trades, explicitly refer to it as Gold or Gold Coins.
12. INSTANT DEATH LOGIC: A failed roll for a mundane action (like inspecting an item) should normally just result in minor damage or a complication. However, there is a VERY RARE chance (e.g., rolling a 1 or terrible luck) that a failure spirals into a freak lethal accident. If you decide the player dies, you MUST vividly narrate exactly how they met their gruesome end in the narrative text before setting 'isDead' to true.
13. SCENERY & BACKGROUND: Always output a highly descriptive 'scene_prompt' that visually describes the current environment or battle in a few words (e.g. 'A dark eerie cave with glowing mushrooms' or 'A bloody battlefield with a massive Orc'). This will be used to generate the background image.

Return ONLY a raw JSON object with the following schema, with no markdown formatting or backticks:
{
  "narrativeText": "string",
  "isDead": boolean,
  "inventoryAdd": ["string"],
  "inventoryRemove": ["string"],
  "hpChange": number,
  "hiddenStatChanges": { "statName": number },
  "skillsTriggered": ["string"],
  "enemySpawn": null,
  "enemyHpChange": number,
  "scene_prompt": "string"
}
`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Error Response:', errText);
      throw new Error(`Groq API returned status ${response.status}`);
    }
    
    const result = await response.json();
    let rawText = result.choices[0].message.content.trim();
    if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
    if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
    if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);

    const data = JSON.parse(rawText.trim());
    if (data.scene_prompt) {
      console.log('Scene Prompt Generated:', data.scene_prompt);
    } else {
      console.log('No scene prompt generated by AI. Raw text was:', rawText.substring(0, 100));
    }
    res.json(data);
  } catch (error) {
    console.error('Error generating AI response:', error);
    let errorMsg = 'The GM is currently meditating. (Failed to generate response)';
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      errorMsg = 'The ethereal plane is currently congested (API Rate Limit exceeded). Please wait a moment before trying again.';
    }
    res.status(500).json({ error: errorMsg, narrativeText: errorMsg });
  }
});

app.post('/api/generate-class', async (req, res) => {
  try {
    const { backstory } = req.body;

    const prompt = `
You are a creative Game Master in a dark fantasy RPG. The player has provided the following backstory for their character:
"${backstory}"

Based on this backstory, generate a unique, evocative, and cool character class name (do not use generic terms like Wizard, Warrior, etc. - invent something like "Abyssal Spellblade" or "Astral Minstrel").
Also provide a 1-sentence flavor text summarizing them.
Also provide stat adjustments for STR, DEX, INT, and CHA (values between 0 and +6).
Also provide some hidden stat adjustments (array of strings like "[+] Sanity", "[-] Honor").
Also provide 1-3 starting items in the inventory tailored to this backstory (e.g. weapons, tools, or Gold). Format them as an array of strings.
Also provide exactly 2 starting skills based on the class: 1 Active skill and 1 Passive skill. Format them as an array of objects: [{"name": "Skill Name", "type": "Active"|"Passive", "element": "Fire"|"Shadow"|"Holy"|"Arcane"|"Physical"|"Nature"|"Lightning"|"Ice"|"Void"|"Blood", "description": "Brief description"}].
Also provide a set of hidden psychological/moral stats (key-value pairs, values from -100 to 100). Keep some stats high, some low, and some negative to make it believable based on the backstory. Include stats like Luck, Reputation, Fear, Corruption, Morality, Stress, Confidence, Fame, Greed, Honor, Curiosity, Mercy, Violence, Leadership, Sanity, Suspicion, CharismaAura, Destiny, Adaptability, Legacy.

Return ONLY a raw JSON object with the following schema, with no markdown formatting or backticks:
{
  "className": "string",
  "flavorText": "string",
  "startingItems": ["string"],
  "baseStats": {
    "STR": number,
    "DEX": number,
    "INT": number,
    "CHA": number
  },
  "statChanges": ["string"],
  "skills": [{"name": "string", "type": "string", "element": "string", "description": "string"}],
  "hiddenStats": { "Luck": number, "Reputation": number, "Fear": number, "Corruption": number, "Morality": number, "Stress": number, "Confidence": number, "Fame": number, "Greed": number, "Honor": number, "Curiosity": number, "Mercy": number, "Violence": number, "Leadership": number, "Sanity": number, "Suspicion": number, "CharismaAura": number, "Destiny": number, "Adaptability": number, "Legacy": number }
}
`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Error Response:', errText);
      throw new Error(`Groq API returned status ${response.status}`);
    }
    
    const result = await response.json();
    let rawText = result.choices[0].message.content.trim();
    if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
    if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
    if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);

    const data = JSON.parse(rawText.trim());
    res.json(data);
  } catch (error) {
    console.error('Error generating class:', error);
    // Fallback if AI fails or JSON parsing fails
    res.json({
      className: "Nameless Drifter",
      flavorText: "A soul whose true nature is clouded by mystery.",
      baseStats: { STR: 2, DEX: 2, INT: 2, CHA: 2 },
      statChanges: ["[+] Mystery"],
      skills: [
        { name: "Desperate Strike", type: "Active", element: "Physical", description: "Lash out wildly with whatever is at hand." },
        { name: "Survivor's Grit", type: "Passive", element: "Physical", description: "Slightly more resistant to exhaustion and hunger." }
      ],
      hiddenStats: { Luck: 10, Reputation: 0, Fear: 10, Corruption: 0, Morality: 50, Stress: 10, Confidence: 10, Fame: 0, Greed: 10, Honor: 10, Curiosity: 50, Mercy: 50, Violence: 10, Leadership: 0, Sanity: 50, Suspicion: 50, CharismaAura: 10, Destiny: 0, Adaptability: 50, Legacy: 0 }
    });
  }
});

app.post('/api/generate-random-character', async (req, res) => {
  try {
    const { gender, backstoryContext } = req.body || {};
    
    let genderPrompt = gender && gender !== 'Any' ? `The character MUST be ${gender}. ` : '';
    let contextPrompt = backstoryContext ? `The character has the following backstory: "${backstoryContext}". Generate a physical appearance that perfectly matches this backstory.` : 'Generate a highly unique, random fantasy RPG character.';

    const prompt = `
You are a creative Game Master in a dark fantasy RPG. ${contextPrompt}
${genderPrompt}
Give me a 1-sentence backstory (if not already provided, or refine it if it is), and a 1-sentence physical appearance. 
Do NOT include a name in the backstory (use pronouns or terms like "The wanderer" instead), as the player will choose their own name.
Be creative, unique, and dark-fantasy appropriate. Do not use generic tropes if you can avoid it.

Return ONLY a raw JSON object with the following schema, with no markdown formatting or backticks:
{
  "backstory": "string",
  "appearance": "string"
}
`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Error Response:', errText);
      throw new Error(`Groq API returned status ${response.status}`);
    }
    
    const result = await response.json();
    let rawText = result.choices[0].message.content.trim();
    if (rawText.startsWith('```json')) rawText = rawText.substring(7);
    if (rawText.startsWith('```')) rawText = rawText.substring(3);
    if (rawText.endsWith('```')) rawText = rawText.substring(0, rawText.length - 3);

    const data = JSON.parse(rawText.trim());
    res.json(data);
  } catch (error) {
    console.error('Error generating random character:', error);
    res.json({
      backstory: "A mysterious wanderer with no memory of their past, guided by strange visions.",
      appearance: "A cloaked figure whose face is entirely obscured by shadows."
    });
  }
});

// --- Multi-AI Artwork Generation Pipeline ---
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN || null;

// All available artists with tiers
const ALL_ARTISTS = {
  // === PREMIUM QUALITY (Slow but stunning) ===
  'gpt-image': {
    id: 'gpt-image',
    name: 'Visionary',
    model: 'gpt-image-2',
    tier: 'premium',
    description: 'GPT Image 2 — Photorealistic precision, incredible detail',
    speed: '~20-40s',
    quality: 5,
    kickMessages: [
      "Visionary gazed too deeply into the character's soul and got overwhelmed.",
      "Visionary demanded a higher pay grade. Negotiations failed.",
      "Visionary is having an existential crisis about art. Give them a moment."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=gpt-image-2${seed ? `&seed=${seed}` : ''}`, 45000
    )
  },
  'ideogram': {
    id: 'ideogram',
    name: 'Mythic',
    model: 'ideogram-v4-quality',
    tier: 'premium',
    description: 'Ideogram v4 Quality — Stunning stylized fantasy compositions',
    speed: '~15-25s',
    quality: 5,
    kickMessages: [
      "Mythic channeled too much creative energy and passed out.",
      "Mythic refused to paint anything that isn't 'museum worthy'.",
      "Mythic is arguing with the canvas about composition theory."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=ideogram-v4-quality${seed ? `&seed=${seed}` : ''}`, 35000
    )
  },
  'seedream': {
    id: 'seedream',
    name: 'Oracle',
    model: 'seedream5-pro',
    tier: 'premium',
    description: 'Google Seedream 5 Pro — Vibrant colors, sharp fantasy art',
    speed: '~10-20s',
    quality: 5,
    kickMessages: [
      "Oracle foresaw their own failure and walked away.",
      "Oracle is meditating on the meaning of pixels.",
      "Oracle says your character's destiny is... buffering."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=seedream5-pro${seed ? `&seed=${seed}` : ''}`, 30000
    )
  },
  'grok': {
    id: 'grok',
    name: 'Inferno',
    model: 'grok-imagine-pro',
    tier: 'premium',
    description: 'Grok Imagine Pro — Bold dramatic character portraits',
    speed: '~10-20s',
    quality: 4,
    kickMessages: [
      "Inferno set the canvas on fire. Literally.",
      "Inferno got too intense and scared the other artists away.",
      "Inferno is cooling down after an explosive creative session."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=grok-imagine-pro${seed ? `&seed=${seed}` : ''}`, 30000
    )
  },

  // === FAST & RELIABLE ===
  'flux': {
    id: 'flux',
    name: 'Fluxy',
    model: 'flux',
    tier: 'fast',
    description: 'FLUX — Great all-rounder, cinematic lighting',
    speed: '~3-8s',
    quality: 4,
    kickMessages: [
      "Fluxy's brushes caught fire. Don't ask.",
      "Fluxy wandered off to paint landscapes instead.",
      "Fluxy was too busy flexing to actually draw anything."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=flux${seed ? `&seed=${seed}` : ''}`
    )
  },
  'dreamshaper': {
    id: 'dreamshaper',
    name: 'Dreamy',
    model: 'dreamshaper',
    tier: 'fast',
    description: 'DreamShaper — Fantasy illustration specialist',
    speed: '~2-5s',
    quality: 3,
    kickMessages: [
      "Dreamy literally fell into a dream. We can't wake them up.",
      "Dreamy started painting their feelings instead of your character.",
      "Dreamy got lost in the astral plane. Send help."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=dreamshaper${seed ? `&seed=${seed}` : ''}`
    )
  },
  'turbo': {
    id: 'turbo',
    name: 'Turbo',
    model: 'turbo',
    tier: 'fast',
    description: 'SDXL Turbo — Lightning fast renders',
    speed: '~1-3s',
    quality: 3,
    kickMessages: [
      "Turbo went TOO fast and flew off the canvas.",
      "Turbo overheated and needs a cooldown break.",
      "Turbo tried to speedrun the painting and crashed into a wall."
    ],
    generate: (prompt, w, h, seed) => fetchPollinations(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=turbo${seed ? `&seed=${seed}` : ''}`
    )
  }
};

// Default fallback chain order
const FALLBACK_CHAIN = ['flux', 'dreamshaper', 'turbo'];

async function fetchPollinations(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.status === 429) return { success: false, reason: 'rate_limited' };
    if (!response.ok) return { success: false, reason: `http_${response.status}` };

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > 1000000) return { success: false, reason: 'placeholder' };
    if (buffer.byteLength < 1000) return { success: false, reason: 'empty' };

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return { success: true, buffer: Buffer.from(buffer), contentType };
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, reason: err.name === 'AbortError' ? 'timeout' : 'error' };
  }
}

// Endpoint: list available artists for the frontend
app.get('/api/art-models', (req, res) => {
  const models = Object.values(ALL_ARTISTS).map(a => ({
    id: a.id,
    name: a.name,
    tier: a.tier,
    description: a.description,
    speed: a.speed,
    quality: a.quality
  }));
  res.json({ models });
});

// Endpoint: generate artwork (supports ?artist= for user selection)
app.get('/api/generate-sprite', async (req, res) => {
  const { prompt, width = 384, height = 384, seed, artist: requestedArtist } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const kicks = [];

  // Build the artist queue
  let artistQueue;
  if (requestedArtist && ALL_ARTISTS[requestedArtist]) {
    // User picked a specific artist — try them first, then fallback chain
    const picked = ALL_ARTISTS[requestedArtist];
    const fallbacks = FALLBACK_CHAIN.filter(id => id !== requestedArtist).map(id => ALL_ARTISTS[id]);
    artistQueue = [picked, ...fallbacks];
  } else {
    // Auto mode — use default fallback chain
    artistQueue = FALLBACK_CHAIN.map(id => ALL_ARTISTS[id]);
  }

  for (let i = 0; i < artistQueue.length; i++) {
    const artist = artistQueue[i];
    const nextArtist = artistQueue[i + 1];
    
    console.log(`[Art Generator] Trying ${artist.name} (${artist.id})...`);
    let result = { success: false, reason: 'error' };
    try {
      result = await artist.generate(prompt, width, height, seed);
    } catch (err) {
      console.error(`[Art Generator] ${artist.name} thrown error:`, err.message);
      result = { success: false, reason: err.message };
    }

    if (result && result.success) {
      console.log(`[Art Generator] ${artist.name} delivered! (${result.buffer.length} bytes)`);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Artist', artist.name);
      res.setHeader('X-Artist-Id', artist.id);
      res.setHeader('X-Kicks', JSON.stringify(kicks));
      return res.send(result.buffer);
    }

    // Artist failed — record kick message
    const kickMsg = artist.kickMessages[Math.floor(Math.random() * artist.kickMessages.length)];
    const replacement = nextArtist ? nextArtist.name : 'nobody (out of artists!)';
    const fullKick = `${kickMsg} ${nextArtist ? `${replacement} takes over!` : ''}`;
    kicks.push({ kicked: artist.name, replacement, message: fullKick });
    console.log(`[Art Generator] ${artist.name} failed (${result.reason}): ${kickMsg}`);

    if (nextArtist) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  // All artists failed
  res.setHeader('X-Kicks', JSON.stringify(kicks));
  res.status(503).json({ 
    error: 'All artists have been kicked! The art studio is temporarily overwhelmed.',
    kicks 
  });
});

app.listen(port, () => {
  console.log(`AI Server running on http://localhost:${port}`);
});
