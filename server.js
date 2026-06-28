import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
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
You are the Game Master in a dark fantasy text-based RPG called 'Islands of Ortsed'. 
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
   - 10-15: Standard success.
   - 16-20+: Critical success. You MUST reward the player with a major advantage (e.g., finding rare/valuable loot, dealing massive damage, uncovering a crucial secret, or gaining a significant buff).
3. Keep your narrative response concise (2-4 sentences). Do not write a novel. Be atmospheric, dark, and descriptive.
4. CRITICAL: NEVER mention the words "roll", "stats", or any numbers related to the dice roll in your narrative. Do NOT say "Because of your low luck" or "The base roll of X". The narrative must be 100% immersive and in-universe. Do not break the fourth wall.
5. If the narrative dictates the player finds an item, add it to 'inventoryAdd'. If an item breaks or is lost, add it to 'inventoryRemove'. Ensure names match the current inventory exactly if removing.
6. PLAYER HEALTH ONLY: 'hpChange' ONLY applies to the PLAYER'S HP. If the PLAYER gets hurt, output a negative number (e.g. -2). If the PLAYER heals, output a positive number. If the PLAYER deals damage to an ENEMY, DO NOT modify 'hpChange' (output 0).
7. DEATH LOGIC: If the narrative dictates the player dies (or their HP will drop to 0), check their inventory. If they have a life-reviving item (like 'Health Potion', 'Phoenix Down', etc.), narrate the item automatically saving their life, add the item to 'inventoryRemove', and set 'isDead' to false. Otherwise, narrate their gruesome death and set 'isDead' to true.
8. DYNAMIC ALIGNMENT: If the character performs an action that violates or embraces a certain morality/psychological trait (e.g., a holy person doing evil, an act of sheer terror, an act of immense curiosity), shift their hidden stats. Output these shifts as an object in 'hiddenStatChanges' (e.g. {"Morality": -5, "Corruption": 5}). Only output shifts if they are highly significant.
9. SKILL TRIGGERS: If any of the player's passive or active skills actively influence the outcome of the action (e.g. saving their life, ensuring a success, granting an advantage), add the EXACT name of the skill to the 'skillsTriggered' array.
10. COMBAT SYSTEM: If the player is IN COMBAT, dictate damage dealt to the ENEMY by outputting a negative number for 'enemyHpChange'. If they kill the enemy, output enough negative enemyHpChange to drop the enemy's HP to 0. If a RANDOM ENCOUNTER was triggered, you MUST output an 'enemySpawn' object containing { "name": "...", "maxHp": number, "str": number, "dex": number, "int": number, "cha": number, "description": "..." }.
11. CURRENCY: The official currency of this world is 'Gold'. Whenever dealing with money, wealth, or trades, explicitly refer to it as Gold or Gold Coins.
12. INSTANT DEATH BAN: Do NOT instantly kill the player or set 'isDead' to true unless they are in combat and take lethal damage, or they perform a deliberately suicidal action. A failed roll for a mundane action (like inspecting an item or walking) should result in minor damage (-1 or -2 HP) or a complication, NEVER instant death.

Return ONLY a raw JSON object with the following schema, with no markdown formatting or backticks:
{
  "narrativeText": "string",
  "inventoryAdd": ["string"],
  "inventoryRemove": ["string"],
  "hpChange": number,
  "isDead": boolean,
  "hiddenStatChanges": { "statName": number },
  "skillsTriggered": ["string"],
  "enemySpawn": { "name": "string", "maxHp": 20, "str": 10, "dex": 10, "int": 10, "cha": 10, "description": "string" },
  "enemyHpChange": 0
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

app.listen(port, () => {
  console.log(`AI Server running on http://localhost:${port}`);
});
