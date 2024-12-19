const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'admin';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Password Hash:', hash);
}

generateHash();