const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../../data/users.json');

// Resolve .env path (supports both .env and env filenames)
const envPath = fs.existsSync(path.join(__dirname, '../../env'))
  ? path.join(__dirname, '../../env')
  : path.join(__dirname, '../../.env');

function readEnvFile() {
  try { return fs.readFileSync(envPath, 'utf8'); } catch (_) { return ''; }
}

function writeEnvFile(content) {
  fs.writeFileSync(envPath, content, 'utf8');
}

// Set or update a single key in the .env file content string
function setEnvKey(content, key, value) {
  const escaped = String(value).replace(/\n/g, '\\n');
  const regex   = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${escaped}`);
  }
  return content.trimEnd() + `\n${key}=${escaped}\n`;
}

function loadUsersData() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Auth] Error loading users data:', err);
  }
  return { users: [], credentials: {} };
}

function saveUsersData(data) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Auth] Error saving users data:', err);
  }
}

function findUser(usernameOrEmail) {
  const data = loadUsersData();
  return data.users.find(u => u.username === usernameOrEmail || u.email === usernameOrEmail);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: `${config.auth.sessionTimeoutHours}h` }
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = findUser(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const data = loadUsersData();
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        connectedClouds: Object.keys(data.credentials[user.id] || {}),
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { username, email, password, name, selectedClouds, credentials } = req.body;
    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (findUser(username) || findUser(email)) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    
    const validClouds = ['aws', 'azure', 'gcp'];
    const invalidClouds = (selectedClouds || []).filter(c => !validClouds.includes(c));
    if (invalidClouds.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid cloud providers: ${invalidClouds.join(', ')}` });
    }

    const data = loadUsersData();
    const newUser = { 
      id: `user-${Date.now()}`, 
      username, 
      email, 
      password, 
      name, 
      connectedClouds: selectedClouds || [] 
    };
    
    data.users.push(newUser);
    data.credentials[newUser.id] = {};
    
    // Save credentials provided during registration
    if (selectedClouds && selectedClouds.length > 0) {
      selectedClouds.forEach(cloud => {
        data.credentials[newUser.id][cloud] = {
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: (credentials && credentials[cloud]) ? credentials[cloud] : {}
        };
      });
    }

    saveUsersData(data);
    const token = generateToken(newUser);
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, username, name, email, connectedClouds: selectedClouds || [] },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── ADD CLOUD ACCOUNT ────────────────────────────────────────────────────────
async function addCloudAccount(req, res) {
  try {
    const userId = req.user.id;
    const { cloud, credentials } = req.body;

    const validClouds = ['aws', 'azure', 'gcp'];
    if (!validClouds.includes(cloud)) {
      return res.status(400).json({ success: false, message: `Invalid cloud: ${cloud}` });
    }

    const data = loadUsersData();
    data.credentials[userId] = data.credentials[userId] || {};
    data.credentials[userId][cloud] = {
      connected: true,
      connectedAt: new Date().toISOString(),
      credentials: credentials || {},
    };
    
    // Update user's connectedClouds array if not present
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      if (!data.users[userIndex].connectedClouds) {
        data.users[userIndex].connectedClouds = [];
      }
      if (!data.users[userIndex].connectedClouds.includes(cloud)) {
        data.users[userIndex].connectedClouds.push(cloud);
      }
    }

    saveUsersData(data);
    const connectedClouds = Object.keys(data.credentials[userId]);

    return res.json({
      success: true,
      message: `${cloud.toUpperCase()} account connected successfully`,
      connectedClouds,
    });
  } catch (err) {
    console.error('[Auth] Add cloud account error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── GET PROFILE ──────────────────────────────────────────────────────────────
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const data = loadUsersData();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const connectedClouds = Object.keys(data.credentials[userId] || {});
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, connectedClouds },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── REMOVE CLOUD ACCOUNT ─────────────────────────────────────────────────────
async function removeCloudAccount(req, res) {
  try {
    const userId = req.user.id;
    const { cloud } = req.params;
    const data = loadUsersData();
    
    if (data.credentials[userId]) {
      delete data.credentials[userId][cloud];
    }
    
    // Remove from user's connectedClouds array
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1 && data.users[userIndex].connectedClouds) {
      data.users[userIndex].connectedClouds = data.users[userIndex].connectedClouds.filter(c => c !== cloud);
    }
    
    saveUsersData(data);
    const connectedClouds = Object.keys(data.credentials[userId] || {});
    return res.json({ success: true, message: `${cloud.toUpperCase()} account removed`, connectedClouds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── GET ALL USERS (ADMIN) ──────────────────────────────────────────────────
async function getAllUsersAdmin(req, res) {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
    }
    const data = loadUsersData();
    return res.json({
      success: true,
      users: data.users,
      credentials: data.credentials
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── DELETE USER (ADMIN) ────────────────────────────────────────────────────
async function deleteUserAdmin(req, res) {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
    }
    const userId = req.params.id;
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete the currently logged in admin user.' });
    }

    const data = loadUsersData();
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Remove user and their credentials
    data.users.splice(userIndex, 1);
    delete data.credentials[userId];

    saveUsersData(data);

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[Auth] Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── GET ADMIN CONFIG ────────────────────────────────────────────────────────
async function getAdminConfig(req, res) {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin only.' });
    }
    const key = config.gemini.apiKey || '';
    return res.json({
      success: true,
      config: {
        useRealData:  config.useRealData,
        geminiApiKey: key ? key.slice(0, 6) + '••••••••' + key.slice(-4) : '',
        geminiConfigured: !!(key && key !== 'your_gemini_api_key_here'),
        nodeEnv:      config.server.env,
        port:         config.server.port,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── SAVE ADMIN CONFIG ────────────────────────────────────────────────────────
async function saveAdminConfig(req, res) {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin only.' });
    }

    const { useRealData, geminiApiKey } = req.body;
    let content = readEnvFile();

    const changes = [];

    if (typeof useRealData === 'boolean') {
      content = setEnvKey(content, 'USE_REAL_DATA', String(useRealData));
      process.env.USE_REAL_DATA = String(useRealData);
      config.useRealData = useRealData;
      changes.push(`USE_REAL_DATA → ${useRealData}`);
    }

    if (geminiApiKey && geminiApiKey.trim() && !geminiApiKey.includes('••')) {
      const trimmed = geminiApiKey.trim();
      content = setEnvKey(content, 'GEMINI_API_KEY', trimmed);
      process.env.GEMINI_API_KEY = trimmed;
      config.gemini.apiKey = trimmed;
      changes.push('GEMINI_API_KEY updated');
    }

    writeEnvFile(content);

    console.log(`[Admin] Config updated by admin: ${changes.join(', ')}`);
    return res.json({
      success: true,
      message: `Config updated: ${changes.join(', ')}`,
      changes,
    });
  } catch (err) {
    console.error('[Admin] Config save error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save config: ' + err.message });
  }
}

module.exports = { login, register, addCloudAccount, getProfile, removeCloudAccount, getAllUsersAdmin, deleteUserAdmin, getAdminConfig, saveAdminConfig };
