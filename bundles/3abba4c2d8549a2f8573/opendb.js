import { openDB } from 'idb'; // IndexedDB helper library
import CryptoJS from 'crypto-js';

// Open or create an IndexedDB
const dbPromise = openDB('passphraseStore', 1, {
  upgrade(db) {
    db.createObjectStore('passphrases');
  },
});

// Encrypt the passphrase before storing it
const encryptPassphrase = (passphrase) => {
  return CryptoJS.AES.encrypt(passphrase, 'your-secret-key').toString();
};

// Decrypt the passphrase when retrieving it
const decryptPassphrase = (encryptedPassphrase) => {
  const bytes = CryptoJS.AES.decrypt(encryptedPassphrase, 'your-secret-key');
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Store the passphrase in IndexedDB
const storePassphrase = async (passphrase) => {
  const encryptedPassphrase = encryptPassphrase(passphrase);
  const db = await dbPromise;
  await db.put('passphrases', encryptedPassphrase, 'savedPassPhrase');
};

// Retrieve the passphrase from IndexedDB
const getPassphrase = async () => {
  const db = await dbPromise;
  const encryptedPassphrase = await db.get('passphrases', 'savedPassPhrase');
  if (encryptedPassphrase) {
    return decryptPassphrase(encryptedPassphrase);
  }
  return null;
};

// In your component's onPassPhraseNextClick function:
onPassPhraseNextClick = async (e) => {
  e.preventDefault();
  if (this.passphraseField.current) {
    await this.passphraseField.current.validate({ allowEmpty: false });
    if (!this.passphraseField.current.state.valid) {
      this.passphraseField.current.focus();
      return;
    }

    // Store passphrase if Remember Me is checked
    if (this.state.rememberMe) {
      await storePassphrase(this.state.passPhrase);
    }

    this.setState({ phase: R.PassphraseConfirm });
  }
};

// In componentDidMount, load the passphrase if it was saved
componentDidMount() {
  getPassphrase().then((passPhrase) => {
    if (passPhrase) {
      this.setState({ passPhrase });
    }
  });
}
