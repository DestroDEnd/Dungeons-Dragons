import { useState, useEffect, useRef } from 'react';
import './index.css';
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';
import LightningEffect from './LightningEffect';

// --- Utility & Mock Functions ---
const rollD20 = () => Math.floor(Math.random() * 20) + 1;

// Dynamic Encounter Generators
const NPC_TYPES = ['goblin', 'bandit', 'corrupted knight', 'shadow stalker', 'feral wolf', 'wandering merchant', 'mad cultist'];
const ADJECTIVES = ['bloodthirsty', 'weary', 'crazed', 'hulking', 'sneaky', 'hostile', 'mysterious'];
const LOOT_ITEMS = ['Health Potion', 'Gold Coin', 'Shiny Ring', 'Rusted Dagger', 'Mystic Scroll', 'Glowing Gem'];

const ELEMENT_COLORS = {
  Fire: 'rgba(255, 51, 51, 0.3)',
  Shadow: 'rgba(138, 43, 226, 0.3)',
  Void: 'rgba(138, 43, 226, 0.3)',
  Holy: 'rgba(255, 215, 0, 0.3)',
  Arcane: 'rgba(0, 255, 255, 0.3)',
  Physical: 'rgba(76, 175, 80, 0.3)',
  Nature: 'rgba(76, 175, 80, 0.3)',
  Lightning: 'rgba(255, 255, 0, 0.3)',
  Ice: 'rgba(0, 191, 255, 0.3)',
  Blood: 'rgba(139, 0, 0, 0.3)'
};

const generateEncounter = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const type = NPC_TYPES[Math.floor(Math.random() * NPC_TYPES.length)];
  return `Suddenly, you encounter a ${adj} ${type} in your path!`;
};

const generateEnvironmentEvent = () => {
  const events = [
    "A thick, unnatural fog rolls in, obscuring your vision.",
    "The ground beneath you crumbles, revealing a hidden pit!",
    "You stumble upon an ancient, moss-covered shrine pulsing with dark magic.",
    "A torrential downpour begins, soaking you to the bone.",
    "You hear a low, rumbling growl echoing from the cavern ahead.",
    "You discover a peaceful, sunlit clearing with a small stream of crystal-clear water.",
    "A gentle breeze carries the sweet scent of blooming night-flowers.",
    "You notice an abandoned, overturned cart by the side of the road. It looks like it hasn't been touched in years."
  ];
  return events[Math.floor(Math.random() * events.length)];
};


function App() {
  // --- App State ---
  const [appState, setAppState] = useState('HOME'); // HOME, LOGIN, CHAR_SELECT, CHAR_CREATE, GAME
  
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('rpg_currentUser') || null);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- Character State ---
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'characters'), (snapshot) => {
      const charData = [];
      snapshot.forEach(d => charData.push({ id: d.id, ...d.data() }));
      setCharacters(charData);
    });
    return () => unsub();
  }, [currentUser]);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  
  // --- Character Creation State ---
  const [createCharName, setCreateCharName] = useState('');
  const [createCharDesc, setCreateCharDesc] = useState('');
  const MAX_BONUS_POINTS = 10;
  const [bonusPoints, setBonusPoints] = useState(MAX_BONUS_POINTS);
  const [allocatedStats, setAllocatedStats] = useState({ STR: 0, DEX: 0, INT: 0, CHA: 0 });

  // --- Game State ---
  const [chatHistory, setChatHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState(null);
  const [hiddenStats, setHiddenStats] = useState(null);
  const [skills, setSkills] = useState(null);
  const [statsPage, setStatsPage] = useState(0); // 0 = Core Stats, 1 = Skills
  const [eventLog, setEventLog] = useState([]);
  const [showEventLogModal, setShowEventLogModal] = useState(false);
  const [guestPromptCount, setGuestPromptCount] = useState(0);
  const [currentEnemy, setCurrentEnemy] = useState(null);
  const [promptCount, setPromptCount] = useState(0);
  const [flashColor, setFlashColor] = useState(null);
  const chatEndRef = useRef(null);

  // --- Slideshow State ---
  const [bgIndex, setBgIndex] = useState(0);
  const BACKGROUNDS = [
  '/backgrounds/beach_forest.png', // 0
  '/backgrounds/tavern.png', // 1
  '/backgrounds/forest.png', // 2
  '/backgrounds/dungeon.png',// 3
  '/backgrounds/castle.png'  // 4
];

  useEffect(() => {
    if (appState === 'HOME' || appState === 'LOGIN') {
      const interval = setInterval(() => {
        setBgIndex(prev => (prev + 1) % BACKGROUNDS.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [appState]);

  // Character Deletion State & Effects
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [deathTimerStart, setDeathTimerStart] = useState(null);
  
  useEffect(() => {
    if (appState === 'CHAR_SELECT' || (appState === 'GAME' && stats?.HP <= 0)) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [appState, stats?.HP]);

  useEffect(() => {
    if (appState === 'GAME' && stats && stats.HP <= 0) {
      if (!deathTimerStart) setDeathTimerStart(Date.now());
    } else {
      if (deathTimerStart) setDeathTimerStart(null);
    }
  }, [appState, stats?.HP, deathTimerStart]);

  useEffect(() => {
    if (appState === 'GAME' && stats?.HP <= 0 && deathTimerStart) {
      const elapsed = Date.now() - deathTimerStart;
      if (elapsed >= 30 * 60 * 1000) {
        if (activeCharacter && currentUser) {
          const updated = characters.filter(c => c.id !== activeCharacter.id);
          setCharacters(updated);
          localStorage.setItem('rpg_characters', JSON.stringify(updated));
        }
        setAppState(currentUser ? 'CHAR_SELECT' : 'HOME');
        setDeathTimerStart(null);
      }
    }
  }, [now, appState, stats?.HP, deathTimerStart, activeCharacter, characters, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const checkExpirations = async () => {
      for (const c of characters) {
        if (c.deletionTimestamp && Date.now() - c.deletionTimestamp >= 30 * 60 * 1000) {
          await deleteDoc(doc(db, 'characters', c.id)).catch(console.error);
        }
      }
    };
    checkExpirations();
  }, [now, characters, currentUser]);

  // Auto-scroll chat
  useEffect(() => {
    if (appState === 'GAME') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, appState]);

  // ESC Game Menu Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && appState === 'GAME') {
        setShowExitModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState]);

  // --- Auth Handlers ---
  const handleRegister = async () => {
    if (!authUsername || !authPassword) {
      setAuthError('Enter username and password.');
      return;
    }
    try {
      const userRef = doc(db, 'users', authUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setAuthError('Error: Username already taken.');
        return;
      }
      await setDoc(userRef, { password: authPassword });
      finishLogin(authUsername);
    } catch (e) {
      console.error(e);
      setAuthError(e.message);
    }
  };

  const handleLogin = async () => {
    if (!authUsername || !authPassword) {
      setAuthError('Enter username and password.');
      return;
    }
    try {
      const userRef = doc(db, 'users', authUsername);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().password === authPassword) {
        finishLogin(authUsername);
      } else {
        setAuthError('Invalid credentials.');
      }
    } catch (e) {
      console.error(e);
      setAuthError(e.message);
    }
  };

  const finishLogin = async (username) => {
    setCurrentUser(username);
    localStorage.setItem('rpg_currentUser', username);
    setAuthError('');
    setAuthUsername('');
    setAuthPassword('');
    
    // If they were playing as a guest mid-game, save their character automatically!
    if (activeCharacter) {
      const savedCharacter = { ...activeCharacter, owner: username, stats, hiddenStats, skills, inventory, chatHistory, eventLog, currentEnemy, promptCount };
      await setDoc(doc(db, 'characters', savedCharacter.id), savedCharacter);
      setActiveCharacter(savedCharacter);
      setGuestPromptCount(0); // Reset prompt count
      addMessage('System', 'system', `ACCOUNT LINKED: Your character ${savedCharacter.name} has been securely saved to your account! You may continue your journey.`);
      setAppState('GAME');
    } else {
      // Just reload if on home as requested previously
      window.location.reload();
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('rpg_currentUser');
    setAppState('HOME');
    setActiveCharacter(null);
  };

  // --- Character Management Handlers ---
  const myCharacters = characters.filter(c => c.owner === currentUser);

  const handleMarkForDeletion = async (e, charId) => {
    e.stopPropagation();
    const char = characters.find(c => c.id === charId);
    if (char && currentUser) {
      await setDoc(doc(db, 'characters', charId), { ...char, deletionTimestamp: Date.now() });
    }
  };

  const handleCancelDeletion = async (e, charId) => {
    e.stopPropagation();
    const char = characters.find(c => c.id === charId);
    if (char && currentUser) {
      const copy = { ...char };
      delete copy.deletionTimestamp;
      await setDoc(doc(db, 'characters', charId), copy);
    }
  };

  const adjustStat = (stat, amount) => {
    if (amount > 0 && bonusPoints > 0) {
      setAllocatedStats(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
      setBonusPoints(prev => prev - 1);
    } else if (amount < 0 && allocatedStats[stat] > 0) {
      setAllocatedStats(prev => ({ ...prev, [stat]: prev[stat] - 1 }));
      setBonusPoints(prev => prev + 1);
    }
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCharacter = async () => {
    if (!createCharName || !createCharDesc) return;
    
    if (currentUser && characters.filter(c => c.owner === currentUser).length >= 7) {
      alert("You have reached the maximum limit of 7 characters.");
      return;
    }

    setIsCreating(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/generate-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backstory: createCharDesc })
      });
      const data = await response.json();

      let finalStats = { 
        STR: 10 + allocatedStats.STR + (data.baseStats?.STR || 0), 
        DEX: 10 + allocatedStats.DEX + (data.baseStats?.DEX || 0), 
        INT: 10 + allocatedStats.INT + (data.baseStats?.INT || 0), 
        CHA: 10 + allocatedStats.CHA + (data.baseStats?.CHA || 0), 
        HP: 20 
      };
      
      let newHidden = data.hiddenStats || { 
        Luck: 10, Reputation: 0, Fear: 0, Corruption: 0, Morality: 50, 
        Stress: 0, Confidence: 50, Fame: 0, Greed: 0, Honor: 50, 
        Curiosity: 10, Mercy: 0, Violence: 0, Leadership: 10, 
        Sanity: 100, Suspicion: 0, CharismaAura: 10, Destiny: 0, 
        Adaptability: 10, Legacy: 0 
      };

      const startingItems = data.startingItems || [data.startingItem || 'Water Flask'];
      
      let newSkills = data.skills || [
        { name: "Desperate Strike", type: "Active", description: "Lash out wildly with whatever is at hand." },
        { name: "Survivor's Grit", type: "Passive", description: "Slightly more resistant to exhaustion and hunger." }
      ];

      const newChar = {
        id: Date.now().toString(),
        owner: currentUser || 'GUEST',
        name: createCharName,
        charClass: data.className || 'Nameless Drifter',
        flavorText: data.flavorText || 'An unknown wanderer seeking their destiny.',
        statChanges: data.statChanges || [],
        stats: finalStats,
        hiddenStats: newHidden,
        skills: newSkills,
        inventory: startingItems,
        eventLog: []
      };

      if (currentUser) {
        await setDoc(doc(db, 'characters', newChar.id), newChar);
        setIsDeleteMode(false);
        setAppState('CHAR_SELECT');
      } else {
        setCharacters([newChar]);
        startGameWithCharacter(newChar);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to consult the oracle. Ensure the backend is running.");
    } finally {
      setIsCreating(false);
      setCreateCharName('');
      setCreateCharDesc('');
      setBonusPoints(MAX_BONUS_POINTS);
      setAllocatedStats({ STR: 0, DEX: 0, INT: 0, CHA: 0 });
    }
  };

  const startGameWithCharacter = (char) => {
    setActiveCharacter(char);
    setStats(char.stats);
    setHiddenStats(char.hiddenStats);
    setSkills(char.skills || {});
    setStatsPage(0);
    setInventory(char.inventory);
    setEventLog(char.eventLog || []);
    setCurrentEnemy(char.currentEnemy || null);
    setPromptCount(char.promptCount || 0);
    setGuestPromptCount(0);

    if (char.chatHistory && char.chatHistory.length > 0) {
      setChatHistory(char.chatHistory);
    } else {
      const randomIslandNum = Math.floor(Math.random() * 8) + 1;
      setChatHistory([
        { sender: 'System', type: 'system', text: 'Connecting to the realm...' },
        { sender: 'Game Master', type: 'gm', text: `You open your eyes slowly. The taste of salt water fills your mouth. You are lying on the sandy beach of Island ${randomIslandNum}. The waves crash gently against the shore, but a dark foreboding presence looms in the dense jungle ahead. What do you do?` }
      ]);
    }
    
    setAppState('GAME');
  };

  // --- Game Engine Handlers ---
  const handleCommand = (cmdStr) => {
    const args = cmdStr.split(' ');
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case '/help':
        addMessage('System', 'system', 'Commands: /bag, /stats, /roll, /history, /debug-hidden');
        break;
      case '/bag':
      case '/inventory':
        addMessage('System', 'system', `Inventory: ${inventory.length > 0 ? inventory.join(', ') : 'Empty'}`);
        break;
      case '/stats':
        addMessage('System', 'system', `Class: ${activeCharacter.charClass} | HP: ${stats.HP} | STR: ${stats.STR} | DEX: ${stats.DEX} | INT: ${stats.INT} | CHA: ${stats.CHA}`);
        break;
      case '/debug-hidden':
        const hiddenStr = Object.entries(hiddenStats).map(([k,v]) => `${k}:${v}`).join(' | ');
        addMessage('System', 'system', `[DEBUG] Hidden: ${hiddenStr}`);
        break;
      case '/roll':
        addMessage('System', 'roll', `You rolled a d20: ${rollD20()}`);
        break;
      case '/history':
        const rh = chatHistory.filter(m => m.type === 'gm').slice(-5).map(m => m.text).join(' | ');
        addMessage('System', 'system', `History: ${rh || 'None.'}`);
        break;
      default:
        addMessage('System', 'system', `Unknown command: ${cmd}`);
    }
  };

  const addMessage = (sender, type, text) => {
    setChatHistory(prev => [...prev, { sender, type, text }]);
  };

  const processAction = (text) => {
    // Guest Prompt Limiting Check
    if (!currentUser) {
      if (guestPromptCount >= 10) {
        addMessage('System', 'system', `TRIAL ENDED: You have reached the limit of 10 prompts for Guest play. Please login or register to automatically save your character and continue your adventure!`);
        return; // Prevent further action
      }
    }

    addMessage(activeCharacter.name, 'user', text);

    // Push the rolling placeholder
    const rollId = Date.now().toString();
    setChatHistory(prev => [...prev, { id: rollId, sender: 'System', type: 'rolling', text: 'Rolling D20...' }]);

    // Roll the dice automatically for the action
    const roll = rollD20();
    
    let isForcedEncounter = false;
    let newPromptCount = promptCount + 1;
    if (!currentEnemy) {
      const isRandomLowRoll = roll >= 1 && roll <= 4 && Math.random() < 0.3; // 30% chance on low roll
      const isTimeForEncounter = newPromptCount >= (Math.floor(Math.random() * 3) + 6); // Every 6-8 prompts
      if (isRandomLowRoll || isTimeForEncounter) {
        isForcedEncounter = true;
        newPromptCount = 0;
      }
    }
    setPromptCount(newPromptCount);
    
    const fetchAIResponse = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatHistory,
            stats,
            hiddenStats,
            skills,
            activeCharacter,
            action: text,
            roll,
            inventory,
            currentEnemy,
            forceEncounter: isForcedEncounter
          })
        });
        return await response.json();
      } catch (err) {
        console.error(err);
        return { narrativeText: "The connection to the ethereal plane has been severed. (Ensure the AI backend is running on port 3000)" };
      }
    };

    Promise.all([
      fetchAIResponse(),
      new Promise(res => setTimeout(res, 4000))
    ]).then(([aiData]) => {
      // Replace rolling message with the actual roll
      setChatHistory(prev => prev.map(msg => 
        msg.id === rollId ? { sender: 'System', type: 'roll', text: `Action Roll: ${roll}` } : msg
      ));
      
      setTimeout(() => {
        let finalOutput = aiData.narrativeText || "The GM remains silent.";
        
        // Ensure AI outputs are arrays to prevent crashes during rendering or state updates
        if (aiData.inventoryAdd && !Array.isArray(aiData.inventoryAdd)) aiData.inventoryAdd = [aiData.inventoryAdd];
        if (aiData.inventoryRemove && !Array.isArray(aiData.inventoryRemove)) aiData.inventoryRemove = [aiData.inventoryRemove];
        if (aiData.skillsTriggered && !Array.isArray(aiData.skillsTriggered)) aiData.skillsTriggered = [aiData.skillsTriggered];
        
        // Handle Enemy State Updates
        if (aiData.enemySpawn && typeof aiData.enemySpawn === 'object' && aiData.enemySpawn.name) {
          setCurrentEnemy({ ...aiData.enemySpawn, hp: aiData.enemySpawn.maxHp || 20 });
          setTimeout(() => addMessage('System', 'system', `COMBAT STARTED: You are now fighting ${aiData.enemySpawn.name}!`), 500);
        }

        if (aiData.enemyHpChange && aiData.enemyHpChange !== 0) {
          setCurrentEnemy(prev => {
            if (!prev) return null;
            let nextHp = prev.hp + aiData.enemyHpChange;
            if (nextHp <= 0) {
              setTimeout(() => addMessage('System', 'system', `ENEMY DEFEATED: You have slain ${prev.name}!`), 1000);
              return null; // Enemy is dead, clear state
            }
            return { ...prev, hp: nextHp };
          });
        }

        // Apply AI-dictated state changes
        setStats(prev => {
          let nextHp = prev.HP + (aiData.hpChange || 0);
          if (aiData.isDead) nextHp = 0;
          if (nextHp <= 0) {
            nextHp = 0;
            setTimeout(() => addMessage('System', 'system', 'YOU ARE DEAD. The timeline continues without you.'), 1000);
          }
          return { ...prev, HP: nextHp };
        });
        
        if (aiData.inventoryAdd?.length > 0 || aiData.inventoryRemove?.length > 0) {
          setInventory(prev => {
            let nextInv = [...prev];
            if (aiData.inventoryRemove) {
              aiData.inventoryRemove.forEach(item => {
                const idx = nextInv.indexOf(item);
                if (idx !== -1) nextInv.splice(idx, 1);
              });
            }
            if (aiData.inventoryAdd) {
              nextInv.push(...aiData.inventoryAdd);
            }
            return nextInv;
          });
        }

        if (aiData.hiddenStatChanges) {
          setHiddenStats(prev => {
            const nextStats = { ...prev };
            Object.entries(aiData.hiddenStatChanges).forEach(([stat, change]) => {
              if (nextStats[stat] !== undefined) {
                nextStats[stat] = Math.max(-100, Math.min(100, nextStats[stat] + change));
              }
            });
            return nextStats;
          });
        }

        if (aiData.skillsTriggered && aiData.skillsTriggered.length > 0) {
          const triggeredSkillNames = aiData.skillsTriggered;
          let foundElement = 'Physical';
          for (let name of triggeredSkillNames) {
            const skillObj = Array.isArray(skills) ? skills.find(s => s.name === name) : null;
            if (skillObj && skillObj.element) {
              foundElement = skillObj.element;
              break;
            }
          }
          setFlashColor(ELEMENT_COLORS[foundElement] || 'rgba(255,255,255,0.3)');
          setTimeout(() => setFlashColor(null), 800);
        }

        if (aiData.hpChange || aiData.inventoryAdd?.length > 0 || aiData.inventoryRemove?.length > 0 || aiData.hiddenStatChanges) {
          const logEntry = {
            id: Date.now().toString(),
            prompt: text,
            hpChange: aiData.hpChange,
            inventoryAdd: aiData.inventoryAdd,
            inventoryRemove: aiData.inventoryRemove,
            hiddenStatChanges: aiData.hiddenStatChanges,
            timestamp: new Date().toLocaleTimeString()
          };
          setEventLog(prev => [...prev, logEntry]);
        }

        addMessage('Game Master', 'gm', finalOutput);
        
        // Post-action Guest Tracking
        if (!currentUser) {
          const newCount = guestPromptCount + 1;
          setGuestPromptCount(newCount);
          if (newCount === 7) {
             addMessage('System', 'system', `WARNING: You are playing as a Guest. You have 3 actions remaining before your trial pauses. Please login to securely save your character and progress!`);
          }
        }
        
      }, 1000);
    });
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    // Hard block if guest hits 10 before even trying to send
    if (!currentUser && guestPromptCount >= 10) {
       addMessage('System', 'system', `TRIAL ENDED: Please click LOGIN at the top right to securely save your character and progress!`);
       return;
    }

    if (inputValue.startsWith('/')) handleCommand(inputValue);
    else {
      // Don't process if dead
      if (stats && stats.HP <= 0) return;
      processAction(inputValue);
    }
    setInputValue('');
  };

  // --- Game Menu Handlers ---
  const handleSaveGame = async () => {
    if (currentUser && activeCharacter) {
      const updatedChar = { ...activeCharacter, stats, hiddenStats, skills, inventory, chatHistory, eventLog, currentEnemy, promptCount };
      try {
        await setDoc(doc(db, 'characters', activeCharacter.id), updatedChar);
        addMessage('System', 'system', 'GAME SAVED TO CLOUD.');
      } catch (e) {
        addMessage('System', 'system', 'ERROR SAVING TO CLOUD.');
      }
    } else {
      addMessage('System', 'system', 'GUESTS CANNOT SAVE. Please login first.');
    }
  };

  const handleExitConfirm = (saveFirst) => {
    if (saveFirst) handleSaveGame();
    setShowExitModal(false);
    setAppState(currentUser ? 'CHAR_SELECT' : 'HOME');
  };

  const renderGameMenu = () => (
    <div className="header-nav">
      <button className="retro-btn primary" onClick={() => setAppState(currentUser ? 'CHAR_SELECT' : 'HOME')}>HOME</button>
      <span style={{color: 'var(--primary-color)', fontSize: '10px', marginLeft: '10px', alignSelf: 'center'}}>(Press ESC for Game Menu)</span>
    </div>
  );

  const renderExitModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 style={{color: 'var(--primary-color)', marginBottom: '1rem'}}>GAME MENU</h2>
        <div className="modal-actions" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <button className="retro-btn" onClick={() => { setShowExitModal(false); setShowEventLogModal(true); }}>VIEW EVENT LOG</button>
          <button className="retro-btn primary" onClick={() => { handleSaveGame(); setShowExitModal(false); }}>SAVE PROGRESS</button>
          <button className="retro-btn" onClick={() => { handleSaveGame(); handleExitConfirm(false); }}>SAVE & EXIT TO MENU</button>
          <button className="retro-btn" onClick={() => handleExitConfirm(false)}>EXIT WITHOUT SAVING</button>
          <button className="retro-btn" onClick={() => { setShowExitModal(false); setAppState(currentUser ? 'CHAR_SELECT' : 'HOME'); }}>RESTART (LOAD LAST SAVE)</button>
          <button className="retro-btn" onClick={() => setShowExitModal(false)}>RESUME GAME</button>
        </div>
      </div>
    </div>
  );

  const renderEventLogModal = () => (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: '600px', maxHeight: '80vh', overflowY: 'auto'}}>
        <h2 style={{color: 'var(--primary-color)', marginBottom: '1rem'}}>EVENT LOG</h2>
        {eventLog.length === 0 ? (
          <p>No major events recorded yet.</p>
        ) : (
          <div style={{textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {eventLog.map(log => (
              <div key={log.id} style={{border: '1px solid var(--border-color)', padding: '10px', backgroundColor: '#111'}}>
                <div style={{color: '#888', fontSize: '10px'}}>{log.timestamp}</div>
                <div style={{color: 'var(--primary-color)', marginBottom: '5px'}}>Action: "{log.prompt}"</div>
                {log.hpChange !== undefined && log.hpChange !== 0 && <div>HP Change: <span style={{color: log.hpChange > 0 ? '#4caf50' : 'var(--danger-color)'}}>{log.hpChange > 0 ? '+' : ''}{log.hpChange}</span></div>}
                {log.inventoryAdd?.length > 0 && <div>Obtained: {log.inventoryAdd.join(', ')}</div>}
                {log.inventoryRemove?.length > 0 && <div>Lost: {log.inventoryRemove.join(', ')}</div>}
                {log.hiddenStatChanges && Object.keys(log.hiddenStatChanges).length > 0 && (
                  <div>
                    Alignment Shifts: {Object.entries(log.hiddenStatChanges).map(([k,v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="retro-btn" style={{marginTop: '15px'}} onClick={() => setShowEventLogModal(false)}>CLOSE</button>
      </div>
    </div>
  );

  // --- Global Header Component ---
  const renderHeader = () => (
    <div className="header-auth">
      {!currentUser ? (
        appState !== 'LOGIN' && (
           <button className="retro-btn primary" onClick={() => setAppState('LOGIN')}>LOGIN</button>
        )
      ) : (
        <div className="user-badge">
          <span>WELCOME, {currentUser}</span>
          <button className="retro-btn" onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );

  // --- Render logic ---
  if (appState === 'HOME') {
    return (
      <div className="home-screen">
        {BACKGROUNDS.map((bg, idx) => (
          <div key={bg} className="slideshow-bg" style={{ backgroundImage: `url('${bg}')`, opacity: bgIndex === idx ? 1 : 0 }} />
        ))}
        <LightningEffect isActive={bgIndex === 0 || bgIndex === 4} />
        <div className="slideshow-overlay" />
        {renderHeader()}

        <h1 className="home-title">ISLANDS<br/>OF ORTSED</h1>
        <p className="home-subtitle">A dark realm awaits. Your choices, your class, your destiny.</p>
        
        <div style={{display: 'flex', gap: '1rem', flexDirection: 'column', alignItems: 'center'}}>
          {currentUser ? (
            <button className="start-btn" onClick={() => setAppState('CHAR_SELECT')}>PRESS START</button>
          ) : (
            <button className="start-btn" onClick={() => setAppState('CHAR_CREATE')}>PLAY AS GUEST</button>
          )}
        </div>
      </div>
    );
  }

  if (appState === 'LOGIN') {
    return (
      <div className="home-screen">
        {BACKGROUNDS.map((bg, idx) => (
          <div key={bg} className="slideshow-bg" style={{ backgroundImage: `url('${bg}')`, opacity: bgIndex === idx ? 1 : 0 }} />
        ))}
        <LightningEffect isActive={bgIndex === 0 || bgIndex === 4} />
        <div className="slideshow-overlay" />
        <h1 className="home-title" style={{fontSize: '2rem'}}>AUTHENTICATION</h1>
        <div className="auth-form" style={{margin: '0 auto', scale: '1.2'}}>
          <input type="text" placeholder="USERNAME" value={authUsername} onChange={e => setAuthUsername(e.target.value)} />
          <input type="password" placeholder="PASSWORD" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
          {authError && <div className="error">{authError}</div>}
          <div className="auth-btn-group">
            <button className="retro-btn" onClick={handleLogin}>Login</button>
            <button className="retro-btn primary" onClick={handleRegister}>Register</button>
          </div>
        </div>
        <button className="retro-btn" style={{marginTop: '2rem'}} onClick={() => { setAuthError(''); setAppState(activeCharacter ? 'GAME' : 'HOME'); }}>BACK</button>
      </div>
    );
  }

  if (appState === 'CHAR_SELECT') {
    return (
      <div className="selection-screen">
        {renderHeader()}
        <h1 className="home-title" style={{fontSize: '2rem'}}>SELECT CHARACTER</h1>
        
        <div className="char-grid">
          {myCharacters.map(char => {
            const isDeleting = !!char.deletionTimestamp;
            let timeRemainingStr = '';
            if (isDeleting) {
              const remaining = 30 * 60 * 1000 - (now - char.deletionTimestamp);
              if (remaining > 0) {
                const hrs = Math.floor(remaining / (1000 * 60 * 60));
                const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((remaining % (1000 * 60)) / 1000);
                timeRemainingStr = `${hrs}h ${mins}m ${secs}s`;
              }
            }

            return (
              <div key={char.id} className="char-card" style={{position: 'relative', opacity: isDeleting ? 0.6 : 1, borderColor: (!isDeleting && isDeleteMode) ? 'var(--danger-color)' : ''}} onClick={() => {
                if (!isDeleting && !isDeleteMode) startGameWithCharacter(char);
              }}>
                {!isDeleting && isDeleteMode && (
                  <button className="retro-btn" style={{position: 'absolute', top: '-10px', right: '-10px', color: 'var(--danger-color)', border: '2px solid var(--danger-color)', width: '30px', height: '30px', borderRadius: '50%', padding: '0', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', lineHeight: '1'}} onClick={(e) => handleMarkForDeletion(e, char.id)}>-</button>
                )}
                <h3>{char.name}</h3>
                
                {isDeleting ? (
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%'}}>
                    <h4 style={{color: 'var(--danger-color)'}}>DELETING IN</h4>
                    <div style={{fontSize: '1.2rem', margin: '1rem 0'}}>{timeRemainingStr}</div>
                    <button className="retro-btn" onClick={(e) => handleCancelDeletion(e, char.id)}>CANCEL</button>
                  </div>
                ) : (
                  <>
                    <p className="flavor-text">"{char.flavorText}"</p>
                    <div className="card-stats">
                      <p>STR:{char.stats.STR} DEX:{char.stats.DEX} INT:{char.stats.INT} CHA:{char.stats.CHA}</p>
                      {char.statChanges && char.statChanges.length > 0 && (
                        <div className="hidden-reveals">
                          {char.statChanges.map((change, idx) => {
                            const isBuff = change.includes('+');
                            const formattedChange = change.replace(/^[\[]?(\+|-)[\]]?\s*/, isBuff ? '[+] ' : '[-] ');
                            return (
                              <span key={idx} className={isBuff ? 'buff' : 'nerf'}>{formattedChange}</span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
          <button className="retro-btn primary" onClick={() => setAppState('CHAR_CREATE')}>+ NEW CHARACTER</button>
          <button className="retro-btn" style={{color: isDeleteMode ? 'var(--danger-color)' : 'inherit', borderColor: isDeleteMode ? 'var(--danger-color)' : 'inherit'}} onClick={() => setIsDeleteMode(!isDeleteMode)}>{isDeleteMode ? 'DONE DELETING' : 'DELETE CHARACTER'}</button>
          <button className="retro-btn" onClick={() => setAppState('HOME')}>BACK</button>
        </div>
      </div>
    );
  }

  if (appState === 'CHAR_CREATE') {
    return (
      <div className="creation-screen">
        {renderHeader()}
        <h1 className="home-title" style={{fontSize: '2rem'}}>CREATE CHARACTER</h1>
        { !currentUser && <p className="flavor-text" style={{fontSize: '12px !important', marginBottom: '1rem'}}>Playing as Guest. Your character will not be saved permanently.</p> }
        
        <div className="create-form">
          <input 
            type="text" 
            placeholder="CHARACTER NAME" 
            value={createCharName} 
            onChange={e => setCreateCharName(e.target.value)} 
          />
          
          <div className="stat-allocation">
            <h3 style={{color: 'var(--warning-color)', marginBottom: '0.5rem', fontSize: '10px'}}>ALLOCATE STATS (POINTS LEFT: {bonusPoints})</h3>
            <div className="point-buy-grid">
              {Object.keys(allocatedStats).map(stat => (
                <div key={stat} className="point-buy-row">
                  <span>{stat}</span>
                  <div className="point-buy-controls">
                    <button className="retro-btn" onClick={() => adjustStat(stat, -1)}>-</button>
                    <span>{10 + allocatedStats[stat]}</span>
                    <button className="retro-btn" onClick={() => adjustStat(stat, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <textarea 
            placeholder="WRITE YOUR BACKSTORY AND LORE HERE..." 
            value={createCharDesc} 
            onChange={e => setCreateCharDesc(e.target.value)} 
            rows="5"
            disabled={isCreating}
          />
          <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
            <button className="retro-btn primary" onClick={handleCreateCharacter} disabled={isCreating}>
              {isCreating ? 'CONSULTING ORACLE...' : 'FORGE DESTINY'}
            </button>
            <button className="retro-btn" onClick={() => {
              setBonusPoints(MAX_BONUS_POINTS);
              setAllocatedStats({ STR: 0, DEX: 0, INT: 0, CHA: 0 });
              setIsDeleteMode(false);
              setAppState(currentUser ? 'CHAR_SELECT' : 'HOME');
            }} disabled={isCreating}>CANCEL</button>
          </div>
        </div>
      </div>
    );
  }

  // GAME Screen
  return (
    <div className="app-container" style={{position: 'relative', paddingTop: '5rem'}}>
      {flashColor && <div className="flash-overlay" style={{ backgroundColor: flashColor, boxShadow: `inset 0 0 100px ${flashColor}` }}></div>}
      {renderHeader()}
      {renderGameMenu()}
      {showExitModal && renderExitModal()}
      {showEventLogModal && renderEventLogModal()}
      <main className="chat-section">
        <div className="chat-history">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`message ${msg.type}`}>
              {msg.type !== 'system' && msg.type !== 'roll' && (
                <span className="message-sender">{msg.sender}</span>
              )}
              <span className="message-text">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        
        <form className="input-area" onSubmit={handleChatSubmit}>
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your action..."
            autoComplete="off"
            autoFocus
            disabled={stats?.HP <= 0 || (!currentUser && guestPromptCount >= 10)}
          />
          <button type="submit" disabled={stats?.HP <= 0 || (!currentUser && guestPromptCount >= 10)}>Send</button>
        </form>
      </main>

      <aside className="sidebar">
        {currentEnemy && (
          <div className="panel" style={{ border: '1px solid var(--danger-color)', boxShadow: '0 0 10px rgba(255,51,51,0.2)' }}>
            <h2 style={{ color: 'var(--danger-color)' }}>ENEMY: {currentEnemy.name?.toUpperCase() || 'UNKNOWN'}</h2>
            <div className="stats-grid">
              <div className="stat-item"><span className="stat-name">HP</span> <span style={{color: 'var(--danger-color)'}}>{currentEnemy.hp}/{currentEnemy.maxHp}</span></div>
              <div className="stat-item"><span className="stat-name">STR</span> <span>{currentEnemy.str}</span></div>
              <div className="stat-item"><span className="stat-name">DEX</span> <span>{currentEnemy.dex}</span></div>
              <div className="stat-item"><span className="stat-name">INT</span> <span>{currentEnemy.int}</span></div>
              <div className="stat-item"><span className="stat-name">CHA</span> <span>{currentEnemy.cha}</span></div>
            </div>
            {currentEnemy.description && (
              <div style={{ fontSize: '10px', marginTop: '10px', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4' }}>
                "{currentEnemy.description}"
              </div>
            )}
          </div>
        )}
        <div className="panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>{statsPage === 0 ? 'Stats' : statsPage === 1 ? 'Skills' : 'Alignment'}</h2>
            <div>
              <button className="retro-btn" style={{padding: '0.2rem 0.5rem', marginRight: '5px'}} onClick={() => setStatsPage(prev => (prev - 1 + 3) % 3)}>&lt;</button>
              <button className="retro-btn" style={{padding: '0.2rem 0.5rem'}} onClick={() => setStatsPage(prev => (prev + 1) % 3)}>&gt;</button>
            </div>
          </div>
          {stats?.HP <= 0 ? (
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div className="dead-text">DEAD</div>
              {deathTimerStart && (
                <div style={{color: 'var(--danger-color)', marginBottom: '1rem'}}>
                  DELETING IN: {Math.max(0, Math.ceil((30 * 60 * 1000 - (now - deathTimerStart))/1000))}s
                </div>
              )}
              <button className="restart-btn" onClick={() => {
                setAppState(currentUser ? 'CHAR_SELECT' : 'HOME');
                setDeathTimerStart(null);
              }}>RESTART</button>
            </div>
          ) : statsPage === 0 ? (
            <div className="stats-grid">
              <div className="stat-item"><span className="stat-name">NAME</span> <span>{activeCharacter?.name}</span></div>
              <div className="stat-item"><span className="stat-name">CLASS</span> <span>{activeCharacter?.charClass}</span></div>
              <div className="stat-item"><span className="stat-name">HP</span> <span style={{color: stats?.HP <= 5 ? 'var(--danger-color)' : 'inherit'}}>{stats?.HP}/20</span></div>
              <div className="stat-item"><span className="stat-name">STR</span> <span>{stats?.STR}</span></div>
              <div className="stat-item"><span className="stat-name">DEX</span> <span>{stats?.DEX}</span></div>
              <div className="stat-item"><span className="stat-name">INT</span> <span>{stats?.INT}</span></div>
              <div className="stat-item"><span className="stat-name">CHA</span> <span>{stats?.CHA}</span></div>
            </div>
          ) : statsPage === 1 ? (
            <div className="stats-grid" style={{gap: '10px', display: 'flex', flexDirection: 'column'}}>
              {Array.isArray(skills) ? skills.map((skill, i) => (
                <div key={i} className="skill-card" style={{border: '1px solid var(--primary-color)', padding: '5px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span className="stat-name" style={{color: skill.type === 'Active' ? '#4caf50' : 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span style={{
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        border: `1px solid ${skill.type === 'Active' ? '#4caf50' : 'var(--primary-color)'}`,
                        backgroundColor: skill.type === 'Active' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(100, 255, 218, 0.1)',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {skill.type === 'Active' ? 'A' : 'P'}
                      </span>
                      {skill.name.toUpperCase()}
                      {skill.element && <span style={{marginLeft: '5px', fontSize: '9px', color: ELEMENT_COLORS[skill.element]?.replace('0.3', '1') || '#ccc'}}>[{skill.element.toUpperCase()}]</span>}
                    </span>
                    {skill.type === 'Active' && (
                      <button className="retro-btn" style={{padding: '2px 5px', fontSize: '10px'}} onClick={() => setInputValue(`I use my ${skill.name} skill to `)}>USE</button>
                    )}
                  </div>
                  <div style={{fontSize: '10px', color: '#ccc', marginTop: '5px'}}>{skill.description}</div>
                </div>
              )) : (
                Object.entries(skills || {}).map(([skill, val]) => (
                  <div key={skill} className="stat-item"><span className="stat-name">{skill.toUpperCase()}</span> <span>{val}</span></div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Inventory</h2>
          <ul className="inventory-list">
            {inventory?.length === 0 ? (
              <li className="inventory-item">Empty</li>
            ) : (
              inventory?.map((item, i) => (
                <li key={i} className="inventory-item">{item}</li>
              ))
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default App;
