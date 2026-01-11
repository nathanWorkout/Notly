// ==================== CONFIGURATION FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyD9NTEtnctct44x27qEBuIhKMZe1GZD8qI",
    authDomain: "appli-de-note.firebaseapp.com",
    projectId: "appli-de-note",
    storageBucket: "appli-de-note.firebasestorage.app",
    messagingSenderId: "910368767610",
    appId: "1:910368767610:web:7fad62a40f6bc4d813c5c3",
    measurementId: "G-0LE86GSLQF"
};

// Initialisation de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== COMPOSANT APP PRINCIPAL ====================
// ==================== COMPOSANT APP PRINCIPAL ====================
function App() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState([]);
  const [selectedNote, setSelectedNote] = React.useState(null);
  const [folders, setFolders] = React.useState([]);
  const [selectedFolder, setSelectedFolder] = React.useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!user) {
      setNotes([]);
      setFolders([]);
      setSelectedNote(null);
      return;
    }

    const unsubscribeFolders = db.collection('folders')
      .where('userId', '==', user.uid)
      .onSnapshot((snapshot) => {
        const foldersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFolders(foldersData);
      });

    const unsubscribeNotes = db.collection('notes')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate().toLocaleDateString('fr-FR') || new Date().toLocaleDateString('fr-FR')
        }));
        setNotes(notesData);
      });

    return () => {
      unsubscribeFolders();
      unsubscribeNotes();
    };
  }, [user]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectFolder = (folderId) => {
    setSelectedFolder(folderId);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const createNote = async () => {
    // Si l'utilisateur n'est pas connecté, afficher le popup d'avertissement
    if (!user) {
      setShowOfflineWarning(true);
      return;
    }

    // Si l'utilisateur est connecté, créer la note normalement
    const newNote = {
      title: "Nouvelle note",
      content: "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      userId: user.uid,
      folderId: selectedFolder || null
    };

    try {
      const docRef = await db.collection('notes').add(newNote);
      const createdNote = {
        id: docRef.id,
        ...newNote,
        createdAt: new Date().toLocaleDateString('fr-FR')
      };
      setSelectedNote(createdNote);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const createNoteWithoutLogin = () => {
    // Créer une note temporaire en mémoire
    const tempNote = {
      id: `temp-${Date.now()}`,
      title: "Nouvelle note (non sauvegardée)",
      content: "",
      createdAt: new Date().toLocaleDateString('fr-FR'),
      userId: null,
      folderId: null,
      isTemporary: true
    };

    setNotes([tempNote, ...notes]);
    setSelectedNote(tempNote);
    setShowOfflineWarning(false);
  };

  const deleteNote = async (id) => {
    // Si c'est une note temporaire, la supprimer directement de l'état
    if (id.toString().startsWith('temp-')) {
      setNotes(notes.filter(n => n.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      return;
    }

    if (!user) return;

    try {
      await db.collection('notes').doc(id).delete();
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const updateNote = async (id, field, value) => {
    // Mettre à jour localement
    setNotes(notes.map(note => 
      note.id === id ? { ...note, [field]: value } : note
    ));

    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, [field]: value });
    }

    // Si c'est une note temporaire, ne pas essayer de sauvegarder
    if (id.toString().startsWith('temp-')) {
      return;
    }

    if (!user) return;

    try {
      await db.collection('notes').doc(id).update({
        [field]: value
      });
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const createNewFolder = async (folderName) => {
    if (!user || !folderName) return;

    try {
      const newFolder = {
        name: folderName,
        userId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('folders').add(newFolder);
      return { id: docRef.id, ...newFolder };
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!user) return;

    try {
      await db.collection('folders').doc(folderId).delete();
      
      const batch = db.batch();
      const notesInFolder = notes.filter(note => note.folderId === folderId);
      
      notesInFolder.forEach(note => {
        const noteRef = db.collection('notes').doc(note.id);
        batch.update(noteRef, { folderId: null });
      });
      
      await batch.commit();
      
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const filteredNotes = selectedFolder 
    ? notes.filter(note => note.folderId === selectedFolder)
    : notes.filter(note => !note.folderId);

  if (loading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: '#6366f1', fontSize: '24px' }}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <Header user={user} />
      
      <button 
        className={`menu-burger ${isSidebarOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={toggleSidebar}
      ></div>
      
      <div className="content">
        <NotesSidebar 
          notes={notes}
          filteredNotes={filteredNotes}
          folders={folders}
          selectedNote={selectedNote}
          selectedFolder={selectedFolder}
          onSelectNote={handleSelectNote}
          onSelectFolder={handleSelectFolder}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onDeleteFolder={deleteFolder}
          onCreateFolder={createNewFolder}
          isOpen={isSidebarOpen}
        />
        <MainContent 
          selectedNote={selectedNote}
          folders={folders}
          onUpdateNote={updateNote}
          onCreateFolder={createNewFolder}
        />
      </div>

      {/* Popup d'avertissement hors connexion */}
      {showOfflineWarning && (
        <OfflineWarningPopup
          onClose={() => setShowOfflineWarning(false)}
          onContinue={createNoteWithoutLogin}
        />
      )}
    </div>
  );
}

// ==================== POPUP D'AVERTISSEMENT HORS CONNEXION ====================
function OfflineWarningPopup({ onClose, onContinue }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            ⚠️
          </div>
          <h3 className="popup-title" style={{ fontSize: '24px', marginBottom: '12px' }}>
            Note non sauvegardée
          </h3>
        </div>
        
        <div style={{ marginBottom: '24px', lineHeight: '1.6' }}>
          <p className="popup-text" style={{ marginBottom: '16px', fontSize: '15px' }}>
            Vous n'êtes pas connecté. Cette note sera <strong style={{ color: '#f59e0b' }}>temporaire</strong> et 
            <strong style={{ color: '#ef4444' }}> ne sera pas sauvegardée</strong>.
          </p>
          
          <div style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid #404040',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#e0e0e0', marginBottom: '12px' }}>
              <strong>⚠️ Attention :</strong>
            </div>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0,
              fontSize: '13px',
              color: '#9ca3af'
            }}>
              <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0 }}>•</span>
                La note sera perdue si vous rechargez la page
              </li>
              <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0 }}>•</span>
                Vous ne pourrez pas la sauvegarder ou l'organiser
              </li>
              <li style={{ paddingLeft: '20px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0 }}>•</span>
                Elle ne sera accessible que pendant cette session
              </li>
            </ul>
          </div>

          <p className="popup-text" style={{ 
            textAlign: 'center', 
            color: '#6366f1',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            💡 Connectez-vous pour sauvegarder vos notes de façon permanente !
          </p>
        </div>

        <div className="popup-buttons" style={{ flexDirection: 'column', gap: '12px' }}>
          <button 
            className="popup-confirm"
            onClick={onClose}
            style={{ 
              width: '100%',
              backgroundColor: '#6366f1',
              order: 1
            }}
          >
            Me connecter
          </button>
          <button 
            className="popup-cancel" 
            onClick={onContinue}
            style={{ 
              width: '100%',
              order: 2,
              backgroundColor: '#404040',
              color: '#e0e0e0'
            }}
          >
            Continuer sans sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== HEADER ====================
function Header({ user }) {
  const [showAuthPopup, setShowAuthPopup] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('login');
  const [showSettingsPopup, setShowSettingsPopup] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(true);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('light-mode');
  };

  return (
    <>
      <header className="header">
        <img src="img/Ntry.svg" alt="Logo de l'app" className="logo" />
        <nav>
          <ul className="nav-button-header">
            {!user ? (
              <>
                <li>
                  <button 
                    className="createAccount"
                    onClick={() => {
                      setAuthMode('signup');
                      setShowAuthPopup(true);
                    }}
                  >
                    Créer un compte
                  </button>
                </li>
                <li>
                  <button 
                    className="login"
                    onClick={() => {
                      setAuthMode('login');
                      setShowAuthPopup(true);
                    }}
                  >
                    Se connecter
                  </button>
                </li>
              </>
            ) : (
              <>
                <li style={{ color: '#9ca3af', fontSize: '14px', marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                  {user.email}
                </li>
                <li>
                  <button 
                    className="disconnect"
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </button>
                </li>
              </>
            )}
            
            <li>
              <button className="settings" onClick={() => setShowSettingsPopup(true)}>
                <img src="img/settings.png" alt="Paramètres" />
              </button>
            </li>
            <li>
              <button className="profil">
                {user && user.photoURL ? (
                <img 
                src={user.photoURL} 
                alt="Photo de profil"
                title={user.displayName || user.email}
                />
                ) : (
                <img src="img/account.png" alt="Profil" />
                )}
              </button>
            </li>
          </ul>
        </nav>
      </header>

      {showAuthPopup && (
        <AuthPopup
          mode={authMode}
          onClose={() => setShowAuthPopup(false)}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
        />
      )}

      {showSettingsPopup && (
        <SettingsPopup
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onClose={() => setShowSettingsPopup(false)}
        />
      )}
    </>
  );
}

// ==================== AUTH POPUP ====================
function AuthPopup({ mode, onClose, onSwitchMode }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
      onClose();
      setEmail('');
      setPassword('');
    } catch (error) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          setError('Cet email est déjà utilisé');
          break;
        case 'auth/invalid-email':
          setError('Email invalide');
          break;
        case 'auth/weak-password':
          setError('Le mot de passe doit contenir au moins 6 caractères');
          break;
        case 'auth/user-not-found':
          setError('Aucun compte trouvé avec cet email');
          break;
        case 'auth/wrong-password':
          setError('Mot de passe incorrect');
          break;
        default:
          setError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      onClose();
    } catch (error) {
      console.error("Erreur connexion Google:", error);
      setError('Erreur lors de la connexion avec Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <h3 className="popup-title" style={{ textAlign: 'center', fontSize: '24px', marginBottom: '24px' }}>
          {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
        </h3>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#ffffff',
            color: '#1a1a1a',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '20px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f3f4f6';
            e.target.style.borderColor = '#d1d5db';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#ffffff';
            e.target.style.borderColor = '#e5e7eb';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connexion...' : 'Continuer avec Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>OU</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label className="popup-text" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              className="popup-input"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ marginBottom: '0' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="popup-text" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Mot de passe
            </label>
            <input
              type="password"
              className="popup-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ marginBottom: '0' }}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="popup-confirm"
            disabled={loading}
            style={{ width: '100%', marginBottom: '12px' }}
          >
            {loading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : 'Créer le compte')}
          </button>

          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <span 
                  style={{ color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={onSwitchMode}
                >
                  Créer un compte
                </span>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <span 
                  style={{ color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={onSwitchMode}
                >
                  Se connecter
                </span>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SETTINGS POPUP ====================
function SettingsPopup({ darkMode, onToggleDarkMode, onClose }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h3 className="popup-title" style={{ textAlign: 'center', fontSize: '24px', marginBottom: '24px' }}>
          Paramètres
        </h3>
        
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '600', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Apparence
          </h4>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px',
            backgroundColor: '#2a2a2a',
            borderRadius: '10px',
            border: '1px solid #404040'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{darkMode ? '🌙' : '☀️'}</span>
              <div>
                <div style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                  {darkMode ? 'Mode sombre' : 'Mode clair'}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>
                  Changer le thème de l'application
                </div>
              </div>
            </div>
            
            <button
              onClick={onToggleDarkMode}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#4f46e5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#6366f1'}
            >
              Changer
            </button>
          </div>
        </div>

        <div style={{ 
          borderTop: '1px solid #2a2a2a',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button 
            className="popup-confirm"
            onClick={onClose}
            style={{ width: 'auto', padding: '12px 32px' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== CREATE FOLDER POPUP ====================
function CreateFolderPopup({ isOpen, onClose, onCreateFolder }) {
  const [folderName, setFolderName] = React.useState("");

  if (!isOpen) return null;

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName("");
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-container">
        <h3 className="popup-title">Nouveau dossier</h3>
        <p className="popup-text">Entrez le nom du nouveau dossier :</p>
        <input
          type="text"
          className="popup-input"
          placeholder="Nom du dossier"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyPress={handleKeyPress}
          autoFocus
        />
        <div className="popup-buttons">
          <button 
            className="popup-cancel" 
            onClick={onClose}
          >
            Annuler
          </button>
          <button 
            className="popup-confirm" 
            onClick={handleCreate}
            disabled={!folderName.trim()}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== NOTES SIDEBAR ====================
function NotesSidebar({ 
  notes, 
  filteredNotes, 
  folders, 
  selectedNote, 
  selectedFolder, 
  onSelectNote, 
  onSelectFolder, 
  onCreateNote, 
  onDeleteNote, 
  onDeleteFolder,
  onCreateFolder,
  isOpen
}) {
  const [deletePopup, setDeletePopup] = React.useState(null);
  const [deleteType, setDeleteType] = React.useState(null);
  const [showCreateFolderPopup, setShowCreateFolderPopup] = React.useState(false);

  const handleCreateFolder = (folderName) => {
    onCreateFolder(folderName);
    setShowCreateFolderPopup(false);
  };

  const handleDelete = (id, type) => {
    if (type === 'note') {
      onDeleteNote(id);
    } else if (type === 'folder') {
      onDeleteFolder(id);
    }
    setDeletePopup(null);
    setDeleteType(null);
  };

  const getNoteCount = (folderId) => {
    return notes.filter(note => note.folderId === folderId).length;
  };

  const getDeleteMessage = () => {
    if (deleteType === 'folder') {
      const folder = folders.find(f => f.id === deletePopup);
      const noteCount = getNoteCount(deletePopup);
      return noteCount > 0 
        ? `Supprimer le dossier "${folder?.name}" ? Les ${noteCount} note(s) qu'il contient seront déplacées vers la racine.`
        : `Supprimer le dossier "${folder?.name}" ?`;
    }
    return 'Supprimer la note ?';
  };

  return (
    <div className={`leftContainer ${isOpen ? 'open' : ''}`}>
      <h2 className="notes-title">Mes pages</h2>
      <ul className="add-note">
        <li>
          <button className="new-note-button" onClick={onCreateNote}>
            <img src="img/add (2).png" alt="Ajouter" />
            Nouvelle page
          </button>
        </li>
        <li>
          <button className="add-new-directory" onClick={() => setShowCreateFolderPopup(true)}>
            <img src="img/folder.png" alt="Dossier" />
            Nouveau dossier
          </button>
        </li>
      </ul>

      <nav>
        <ul className="note-list">
          <li>
            <button
              onClick={() => onSelectFolder(null)}
              className={`folder-button ${selectedFolder === null ? 'selected' : ''}`}
            >
              <div className="folder-content">
                <div className="folder-icon-wrapper">
                  <img src="img/page(2).png" alt="Page" className="folder-icon-img" />
                </div>
                <div className="folder-info">
                  <div className="folder-name">Toutes les notes</div>
                  <div className="folder-count">{notes.filter(n => !n.folderId).length} note(s)</div>
                </div>
              </div>
            </button>
          </li>

          {folders.map(folder => (
            <li key={folder.id}>
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`folder-button ${selectedFolder === folder.id ? 'selected' : ''}`}
              >
                <div className="folder-content">
                  <div className="folder-icon-wrapper">
                    <img src="img/folder(1).png" alt="Dossier" className="folder-icon-img" />
                  </div>
                  <div className="folder-info">
                    <div className="folder-name">{folder.name}</div>
                    <div className="folder-count">{getNoteCount(folder.id)} note(s)</div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePopup(folder.id);
                      setDeleteType('folder');
                    }}
                    className="delete-folder-button"
                  >
                    <img src="img/delete.png" alt="Supprimer" />
                  </button>
                </div>
              </button>
            </li>
          ))}
          
          {folders.length > 0 && <li className="separator"></li>}

          {filteredNotes.map(note => (
            <li key={note.id} className="note-item">
              <button
                onClick={() => onSelectNote(note)}
                className={`note-button ${selectedNote?.id === note.id ? 'selected' : ''}`}
              >
                <div className="note-content">
                  <div className="note-title-wrapper">
                    <div className="note-title">{note.title}</div>
                    <div className="note-date">{note.createdAt}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePopup(note.id);
                      setDeleteType('note');
                    }}
                    className="delete-button"
                  >
                    <img src="img/delete.png" alt="Supprimer" />
                  </button>
                </div>
              </button>
            </li>
          ))}

          {filteredNotes.length === 0 && (
            <li className="empty-state">
              Aucune note dans ce dossier
            </li>
          )}
        </ul>
      </nav>

      {deletePopup && (
        <div className="popup-overlay">
          <div className="popup-container">
            <h3 className="popup-title">
              {deleteType === 'folder' ? 'Supprimer le dossier ?' : 'Supprimer la note ?'}
            </h3>
            <p className="popup-text">
              {getDeleteMessage()}
              <br />
              <span style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', display: 'inline-block' }}>
                Cette action est irréversible.
              </span>
            </p>
            <div className="popup-buttons">
              <button 
                className="popup-cancel" 
                onClick={() => {
                  setDeletePopup(null);
                  setDeleteType(null);
                }}
              >
                Annuler
              </button>
              <button 
                className="popup-confirm popup-delete" 
                onClick={() => handleDelete(deletePopup, deleteType)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateFolderPopup
        isOpen={showCreateFolderPopup}
        onClose={() => setShowCreateFolderPopup(false)}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
}

// ==================== SAVE POPUP ====================
function SavePopup({ isOpen, onClose, folders, selectedNote, onSave, onCreateFolder }) {
  const [selectedFolder, setSelectedFolder] = React.useState(selectedNote?.folderId || null);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedFolder);
    onClose();
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = onCreateFolder(newFolderName.trim());
      if (newFolder) {
        setSelectedFolder(newFolder.id);
      }
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="popup-overlay">
      <div className="save-popup-container">
        <div className="save-popup-header">
          <h3 className="save-popup-title">Enregistrer la note</h3>
          <button className="save-popup-close" onClick={onClose}>×</button>
        </div>

        <div className="save-popup-body">
          <div className="save-note-info">
            <div className="save-note-icon">📝</div>
            <div className="save-note-name">{selectedNote?.title || "Sans titre"}</div>
          </div>

          <div className="save-section">
            <label className="save-label">Choisir un dossier</label>
            
            <div className="folder-list">
              <button
                className={`folder-option ${selectedFolder === null ? 'selected' : ''}`}
                onClick={() => setSelectedFolder(null)}
              >
                <img src="img/page(2).png" alt="Page" className="folder-option-icon" />
                <span>Aucun dossier (racine)</span>
                {selectedFolder === null && <span className="check-icon">✓</span>}
              </button>

              {folders.map(folder => (
                <button
                  key={folder.id}
                  className={`folder-option ${selectedFolder === folder.id ? 'selected' : ''}`}
                  onClick={() => setSelectedFolder(folder.id)}
                >
                  <img src="img/folder(1).png" alt="Dossier" className="folder-option-icon" />
                  <span>{folder.name}</span>
                  {selectedFolder === folder.id && <span className="check-icon">✓</span>}
                </button>
              ))}
            </div>

            {!isCreatingFolder ? (
              <button 
                className="create-folder-btn"
                onClick={() => setIsCreatingFolder(true)}
              >
                <span>+</span> Créer un nouveau dossier
              </button>
            ) : (
              <div className="new-folder-input-container">
                <input
                  type="text"
                  className="new-folder-input"
                  placeholder="Nom du dossier"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                />
                <div className="new-folder-actions">
                  <button 
                    className="new-folder-cancel"
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Annuler
                  </button>
                  <button 
                    className="new-folder-create"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                  >
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="save-popup-footer">
          <button className="save-popup-cancel" onClick={onClose}>
            Annuler
          </button>
          <button className="save-popup-confirm" onClick={handleSave}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MEDIA POPUP ====================
function MediaPopup({ isOpen, onClose, type, onInsert }) {
  const [activeTab, setActiveTab] = React.useState('upload');
  const [url, setUrl] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const fileInputRef = React.useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(droppedFile);
    }
  };

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    if (newUrl) {
      setPreview(newUrl);
    }
  };

  const handleInsert = () => {
    const mediaUrl = activeTab === 'upload' ? preview : url;
    if (mediaUrl) {
      onInsert(type, mediaUrl);
    }
    onClose();
    setUrl('');
    setFile(null);
    setPreview(null);
    setActiveTab('upload');
  };

  const canInsert = (activeTab === 'upload' && file) || (activeTab === 'url' && url);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="media-popup-container" onClick={(e) => e.stopPropagation()}>
        <div className="media-popup-header">
          <h3 className="media-popup-title">
            {type === 'image' ? 'Insérer une image' : 'Insérer une vidéo'}
          </h3>
          <button className="media-popup-close" onClick={onClose}>×</button>
        </div>

        <div className="media-popup-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="media-tabs">
            <button
              className={`media-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📁 Fichier local
            </button>
            <button
              className={`media-tab ${activeTab === 'url' ? 'active' : ''}`}
              onClick={() => setActiveTab('url')}
            >
              🔗 URL
            </button>
          </div>

          <div className={`media-tab-content ${activeTab === 'upload' ? 'active' : ''}`}>
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                <img src={type === 'image' ? '/img/image(1).png' : '/img/video(1).png'} alt={type === 'image' ? 'Image' : 'Vidéo'} />
              </div>
              <div className="upload-text">
                {file ? 'Fichier sélectionné' : 'Cliquez ou glissez un fichier'}
              </div>
              <div className="upload-subtext">
                {type === 'image' ? 'PNG, JPG, GIF jusqu\'à 10MB' : 'MP4, WebM jusqu\'à 50MB'}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="upload-input"
              accept={type === 'image' ? 'image/*' : 'video/*'}
              onChange={handleFileChange}
            />
            {preview && activeTab === 'upload' && (
              <div className="preview-container">
                <div className="preview-label">Aperçu :</div>
                {type === 'image' ? (
                  <img src={preview} alt="Preview" className="preview-image" />
                ) : (
                  <video src={preview} controls className="preview-video" />
                )}
                <div className="preview-filename">{file?.name}</div>
              </div>
            )}
          </div>

          <div className={`media-tab-content ${activeTab === 'url' ? 'active' : ''}`}>
            <div className="url-input-container">
              <label className="url-input-label">
                URL de {type === 'image' ? 'l\'image' : 'la vidéo'} :
              </label>
              <input
                type="text"
                className="url-input"
                placeholder={type === 'image' ? 'https://exemple.com/image.jpg' : 'https://exemple.com/video.mp4'}
                value={url}
                onChange={handleUrlChange}
              />
            </div>
            {preview && activeTab === 'url' && (
              <div className="preview-container">
                <div className="preview-label">Aperçu :</div>
                {type === 'image' ? (
                  <img src={preview} alt="Preview" className="preview-image" onError={() => setPreview(null)} />
                ) : (
                  <video src={preview} controls className="preview-video" onError={() => setPreview(null)} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="media-popup-footer">
          <button className="media-popup-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="media-popup-insert"
            onClick={handleInsert}
            disabled={!canInsert}
          >
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MIND MAP POPUP ====================
function MindMapPopup({ isOpen, onClose, onInsert }) {
  const [nodes, setNodes] = React.useState([
    { id: 1, text: 'Idée centrale', x: 400, y: 250, parent: null }
  ]);
  const [selectedNode, setSelectedNode] = React.useState(1);
  const [dragging, setDragging] = React.useState(null);
  const [editingNode, setEditingNode] = React.useState(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [tapTimeout, setTapTimeout] = React.useState(null);
  const [lastTap, setLastTap] = React.useState(0);
  const canvasRef = React.useRef(null);

  if (!isOpen) return null;

  const colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5'];

  const addChildNode = () => {
    if (!selectedNode) return;
    const parent = nodes.find(n => n.id === selectedNode);
    if (parent) {
      const children = nodes.filter(n => n.parent === selectedNode);
      const angle = (children.length * 60) - 30;
      const rad = (angle * Math.PI) / 180;
      const distance = 200;
      
      const newNode = {
        id: Date.now(),
        text: 'Nouvelle idée',
        x: parent.x + Math.cos(rad) * distance,
        y: parent.y + Math.sin(rad) * distance,
        parent: selectedNode
      };
      setNodes([...nodes, newNode]);
    }
  };

  const deleteNode = () => {
    if (!selectedNode || selectedNode === 1) return;
    
    const toDelete = [selectedNode];
    const findChildren = (id) => {
      nodes.forEach(n => {
        if (n.parent === id) {
          toDelete.push(n.id);
          findChildren(n.id);
        }
      });
    };
    findChildren(selectedNode);
    
    setNodes(nodes.filter(n => !toDelete.includes(n.id)));
    setSelectedNode(1);
  };

  const updateNodeText = (nodeId, text) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, text } : n));
  };

  // ========== GESTION SOURIS (Desktop) ==========
  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target.tagName === 'line') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleNodeMouseDown = (e, node) => {
    if (editingNode === node.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ 
      id: node.id, 
      offsetX: e.clientX - rect.left - offset.x - node.x, 
      offsetY: e.clientY - rect.top - offset.y - node.y 
    });
    setSelectedNode(node.id);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x - dragging.offsetX);
      const y = (e.clientY - rect.top - offset.y - dragging.offsetY);
      setNodes(nodes.map(n => n.id === dragging.id ? { ...n, x, y } : n));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  // ========== GESTION TACTILE (Mobile) ==========
  const handleCanvasTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = e.target;
      
      // Si on touche le canvas, le SVG ou une ligne, activer le panning
      if (target === canvasRef.current || 
          target.tagName === 'svg' || 
          target.tagName === 'line' ||
          target.classList.contains('mindmap-connections')) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ 
          x: touch.clientX - offset.x, 
          y: touch.clientY - offset.y 
        });
      }
    }
  };

  const handleNodeTouchStart = (e, node) => {
    if (editingNode === node.id) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    // Détection du double-tap (moins de 300ms entre deux taps)
    if (tapLength < 300 && tapLength > 0) {
      // Double-tap détecté : éditer le nœud
      setEditingNode(node.id);
      setLastTap(0);
      if (tapTimeout) clearTimeout(tapTimeout);
      return;
    }
    
    // Simple tap : préparer le dragging
    setLastTap(currentTime);
    
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ 
      id: node.id, 
      offsetX: touch.clientX - rect.left - offset.x - node.x, 
      offsetY: touch.clientY - rect.top - offset.y - node.y 
    });
    setSelectedNode(node.id);
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      
      if (isPanning) {
        e.preventDefault();
        setOffset({
          x: touch.clientX - panStart.x,
          y: touch.clientY - panStart.y
        });
      } else if (dragging) {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (touch.clientX - rect.left - offset.x - dragging.offsetX);
        const y = (touch.clientY - rect.top - offset.y - dragging.offsetY);
        setNodes(nodes.map(n => n.id === dragging.id ? { ...n, x, y } : n));
      }
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setDragging(null);
    setIsPanning(false);
  };

  const handleInsert = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d', { alpha: true });
    
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 3;
    nodes.forEach(node => {
      if (node.parent) {
        const parent = nodes.find(n => n.id === node.parent);
        if (parent) {
          ctx.beginPath();
          ctx.moveTo(parent.x * 1.5, parent.y * 1.6);
          ctx.lineTo(node.x * 1.5, node.y * 1.6);
          ctx.stroke();
        }
      }
    });
    
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    nodes.forEach((node, index) => {
      const x = node.x * 1.5;
      const y = node.y * 1.6;
      const width = Math.max(140, ctx.measureText(node.text).width + 40);
      const height = 50;
      
      const gradient = ctx.createLinearGradient(x - width/2, y - height/2, x + width/2, y + height/2);
      if (node.id === 1) {
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#7c3aed');
      } else {
        const colorIndex = index % 5;
        const colorMap = [
          ['#6366f1', '#4f46e5'],
          ['#ec4899', '#db2777'],
          ['#f59e0b', '#d97706'],
          ['#10b981', '#059669'],
          ['#3b82f6', '#2563eb']
        ];
        gradient.addColorStop(0, colorMap[colorIndex][0]);
        gradient.addColorStop(1, colorMap[colorIndex][1]);
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x - width/2, y - height/2, width, height, 10);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(node.text, x, y);
    });
    
    const imageUrl = canvas.toDataURL('image/png');
    onInsert('mindmap', imageUrl);
    onClose();
  };

  const getColorClass = (node, index) => {
    if (node.id === 1) return 'central';
    return colors[index % colors.length];
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="mindmap-popup-container" onClick={(e) => e.stopPropagation()}>
        
        <div className="mindmap-header">
          <h3 className="mindmap-title">
            <img src="img/mindmap.png" alt="Mind Map" /> Mind Map
          </h3>
          <button className="media-popup-close" onClick={onClose}>×</button>
        </div>

        <div className="mindmap-toolbar">
          <button
            onClick={addChildNode}
            disabled={!selectedNode}
            className={`mindmap-btn ${selectedNode ? 'mindmap-btn-primary' : ''}`}
          >
            <span>+</span> Ajouter
          </button>
          
          <button
            onClick={deleteNode}
            disabled={!selectedNode || selectedNode === 1}
            className={`mindmap-btn mindmap-btn-danger ${(!selectedNode || selectedNode === 1) ? '' : ''}`}
          >
            <img src="img/delete.png" alt="Supprimer" /> Supprimer
          </button>
          
          <div className="mindmap-hint">
            <span>Glissez pour déplacer • Double-tap pour éditer</span>
          </div>
        </div>

        <div 
          ref={canvasRef}
          className="mindmap-canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            cursor: isPanning ? 'grabbing' : (dragging ? 'grabbing' : 'grab'),
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          <div style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px)`, 
            position: 'relative', 
            width: '100%', 
            height: '100%',
            pointerEvents: 'none'
          }}>
            <svg className="mindmap-connections" style={{ pointerEvents: 'none' }}>
              {nodes.map(node => {
                if (!node.parent) return null;
                const parent = nodes.find(n => n.id === node.parent);
                if (!parent) return null;
                return (
                  <line
                    key={`line-${node.id}`}
                    x1={parent.x}
                    y1={parent.y}
                    x2={node.x}
                    y2={node.y}
                    className="mindmap-line"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}
            </svg>

            {nodes.map((node, index) => (
              <div
                key={node.id}
                className={`mindmap-node ${getColorClass(node, index)} ${selectedNode === node.id ? 'selected' : ''}`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onTouchStart={(e) => handleNodeTouchStart(e, node)}
                onDoubleClick={() => setEditingNode(node.id)}
              >
                {editingNode === node.id ? (
                  <input
                    type="text"
                    className="mindmap-node-input"
                    value={node.text}
                    onChange={(e) => updateNodeText(node.id, e.target.value)}
                    onBlur={() => setEditingNode(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    style={{ 
                      touchAction: 'auto',
                      WebkitUserSelect: 'text',
                      userSelect: 'text'
                    }}
                  />
                ) : (
                  node.text
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mindmap-footer">
          <button className="mindmap-cancel" onClick={onClose}>
            Annuler
          </button>
          <button className="mindmap-insert" onClick={handleInsert}>
            Insérer dans la note
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN CONTENT ====================
function MainContent({ selectedNote, folders, onUpdateNote, onCreateFolder }) {
  const [showSavePopup, setShowSavePopup] = React.useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = React.useState(false);
  const [savedFolderName, setSavedFolderName] = React.useState("");
  const [activeFormats, setActiveFormats] = React.useState({});
  const [showMediaPopup, setShowMediaPopup] = React.useState(false);
  const [showMindMapPopup, setShowMindMapPopup] = React.useState(false);
  const [mediaType, setMediaType] = React.useState('image');
  const [localTitle, setLocalTitle] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const quillRef = React.useRef(null);

  // Détection du redimensionnement
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (selectedNote) {
      setLocalTitle(selectedNote.title);
    }
  }, [selectedNote?.id]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);
    onUpdateNote(selectedNote.id, 'title', newTitle);
  };

  React.useEffect(() => {
    if (quillRef.current) {
      quillRef.current = null;
      const editorElement = document.getElementById('editor');
      if (editorElement) {
        editorElement.innerHTML = '';
      }
    }

    if (selectedNote) {
      const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
          toolbar: false
        }
      });

      quill.root.innerHTML = selectedNote.content || '';

      quill.on('text-change', () => {
        onUpdateNote(selectedNote.id, 'content', quill.root.innerHTML);
      });

      quill.on('selection-change', (range) => {
        if (range) {
          const formats = quill.getFormat(range);
          setActiveFormats({
            bold: formats.bold || false,
            italic: formats.italic || false,
            underline: formats.underline || false,
            strike: formats.strike || false,
            'list-bullet': formats.list === 'bullet',
            'list-ordered': formats.list === 'ordered',
            'header-1': formats.header === 1,
            'header-2': formats.header === 2,
            'header-3': formats.header === 3
          });
        }
      });

      const makeMediaResizable = () => {
        const images = quill.root.querySelectorAll('img');
        const videos = quill.root.querySelectorAll('video');
        
        [...images, ...videos].forEach(media => {
          if (!media.classList.contains('resizable')) {
            media.classList.add('resizable');
            media.style.cursor = 'move';
            media.style.maxWidth = '100%';
            media.style.height = 'auto';
            media.style.touchAction = 'none';
            media.draggable = false;

            let isInteracting = false;
            let startX, startY, startWidth;
            let lastTouchDistance = 0;

            // GESTION SOURIS
            media.addEventListener('wheel', (e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newWidth = media.offsetWidth * delta;
                media.style.width = newWidth + 'px';
              }
            });

            media.addEventListener('mousedown', (e) => {
              if (e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startY = e.clientY;
                isInteracting = true;
              }
            });

            document.addEventListener('mousemove', (e) => {
              if (isInteracting) {
                e.preventDefault();
                e.stopPropagation();
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                  media.style.position = 'relative';
                  media.style.left = (parseFloat(media.style.left) || 0) + deltaX + 'px';
                  media.style.top = (parseFloat(media.style.top) || 0) + deltaY + 'px';
                  startX = e.clientX;
                  startY = e.clientY;
                }
              }
            });

            document.addEventListener('mouseup', () => {
              isInteracting = false;
            });

            // GESTION TACTILE
            const getTouchDistance = (touch1, touch2) => {
              const dx = touch2.clientX - touch1.clientX;
              const dy = touch2.clientY - touch1.clientY;
              return Math.sqrt(dx * dx + dy * dy);
            };

            media.addEventListener('touchstart', (e) => {
              e.stopPropagation();
              
              if (e.touches.length === 1) {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                isInteracting = true;
              } else if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                lastTouchDistance = getTouchDistance(touch1, touch2);
                startWidth = media.offsetWidth;
                isInteracting = true;
              }
            });

            media.addEventListener('touchmove', (e) => {
              if (!isInteracting) return;

              if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                  media.style.position = 'relative';
                  media.style.left = (parseFloat(media.style.left) || 0) + deltaX + 'px';
                  media.style.top = (parseFloat(media.style.top) || 0) + deltaY + 'px';
                  startX = touch.clientX;
                  startY = touch.clientY;
                }
              } else if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = getTouchDistance(touch1, touch2);
                
                if (lastTouchDistance > 0) {
                  const scale = currentDistance / lastTouchDistance;
                  const newWidth = startWidth * scale;
                  
                  if (newWidth >= 50 && newWidth <= 1000) {
                    media.style.width = newWidth + 'px';
                  }
                }
                
                lastTouchDistance = currentDistance;
                startWidth = media.offsetWidth;
              }
            });

            media.addEventListener('touchend', (e) => {
              isInteracting = false;
              lastTouchDistance = 0;
              
              if (e.changedTouches.length === 1 && !e.cancelable) {
                e.stopPropagation();
              }
            });

            media.addEventListener('touchcancel', () => {
              isInteracting = false;
              lastTouchDistance = 0;
            });
          }
        });
      };

      const observer = new MutationObserver(makeMediaResizable);
      observer.observe(quill.root, { childList: true, subtree: true });
      makeMediaResizable();

      quillRef.current = quill;

      return () => {
        observer.disconnect();
      };
    }
  }, [selectedNote?.id]);

  const handleFormat = (format, value = true) => {
    if (quillRef.current) {
      const quill = quillRef.current;
      const range = quill.getSelection();
      
      if (range) {
        const currentFormat = quill.getFormat(range);
        
        if (format === 'header') {
          const isActive = currentFormat.header === value;
          quill.format('header', isActive ? false : value);
        } else if (format === 'list') {
          const isActive = currentFormat.list === value;
          quill.format('list', isActive ? false : value);
        } else {
          const isActive = currentFormat[format];
          quill.format(format, !isActive);
        }
        
        setTimeout(() => {
          const formats = quill.getFormat(range);
          setActiveFormats({
            bold: formats.bold || false,
            italic: formats.italic || false,
            underline: formats.underline || false,
            strike: formats.strike || false,
            'list-bullet': formats.list === 'bullet',
            'list-ordered': formats.list === 'ordered',
            'header-1': formats.header === 1,
            'header-2': formats.header === 2,
            'header-3': formats.header === 3
          });
        }, 0);
      }
    }
  };

  const imageAction = () => {
    setMediaType('image');
    setShowMediaPopup(true);
  };

  const videoAction = () => {
    setMediaType('video');
    setShowMediaPopup(true);
  };

  const handleInsertMedia = (type, mediaUrl) => {
    if (quillRef.current && mediaUrl) {
      const quill = quillRef.current;
      const range = quill.getSelection() || { index: quill.getLength() };
      
      if (type === 'image') {
        quill.insertEmbed(range.index, 'image', mediaUrl);
      } else if (type === 'video') {
        quill.insertEmbed(range.index, 'video', mediaUrl);
      }
      
      quill.setSelection(range.index + 1);
    }
  };

  const handleInsertMindMap = (type, imageUrl) => {
    if (quillRef.current && imageUrl) {
      const quill = quillRef.current;
      const range = quill.getSelection();
      const index = range ? range.index : quill.getLength();
      
      quill.insertEmbed(index, 'image', imageUrl);
      quill.setSelection(index + 1);
      
      setTimeout(() => {
        onUpdateNote(selectedNote.id, 'content', quill.root.innerHTML);
      }, 100);
    }
  };

  const handleSave = (folderId) => {
    if (selectedNote) {
      onUpdateNote(selectedNote.id, 'folderId', folderId);
      
      const folderName = folderId 
        ? folders.find(f => f.id === folderId)?.name || "dossier"
        : "racine";
      
      setSavedFolderName(folderName);
      setShowSuccessPopup(true);
      
      setTimeout(() => {
        setShowSuccessPopup(false);
      }, 2000);
    }
  };

  if (!selectedNote) {
    return <div className="mainContent"></div>;
  }

  return (
    <div className="mainContent">
      <div className="editor-container" style={{ 
        padding: isMobile ? '16px' : '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
        paddingBottom: isMobile ? '80px' : '20px'
      }}>
        <div className="editor-header" style={{
          marginBottom: isMobile ? '4px' : '0',
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            className="title-input"
            placeholder="Titre de la note"
            style={{
              flex: 1,
              padding: isMobile ? '14px 16px' : '12px 20px',
              fontSize: isMobile ? '18px' : '20px',
              borderRadius: isMobile ? '12px' : '10px',
              minHeight: isMobile ? '48px' : 'auto'
            }}
          />
          <button 
            className="save-button"
            onClick={() => setShowSavePopup(true)}
            style={{
              padding: isMobile ? '12px' : '12px',
              minWidth: isMobile ? '48px' : '48px',
              minHeight: isMobile ? '48px' : '48px',
              borderRadius: isMobile ? '12px' : '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img src="img/save.png" alt="Sauvegarder" style={{ 
              width: isMobile ? '24px' : '20px',
              height: isMobile ? '24px' : '20px'
            }}/>
          </button>
        </div>
        
        <div id="editor" ref={quillRef} style={{ 
          flex: 1, 
          backgroundColor: 'transparent',
          minHeight: isMobile ? 'calc(100vh - 280px)' : 'auto',
          padding: isMobile ? '16px 8px' : '20px',
          fontSize: isMobile ? '16px' : '15px',
          lineHeight: isMobile ? '1.7' : '1.5',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: isMobile ? '12px' : '8px'
        }}></div>
      </div>

      <SavePopup
        isOpen={showSavePopup}
        onClose={() => setShowSavePopup(false)}
        folders={folders}
        selectedNote={selectedNote}
        onSave={handleSave}
        onCreateFolder={onCreateFolder}
      />

      <MediaPopup
        isOpen={showMediaPopup}
        onClose={() => setShowMediaPopup(false)}
        type={mediaType}
        onInsert={handleInsertMedia}
      />

      <MindMapPopup
        isOpen={showMindMapPopup}
        onClose={() => setShowMindMapPopup(false)}
        onInsert={handleInsertMindMap}
      />

      {showSuccessPopup && (
        <div className="success-notification">
          <div className="success-content">
            <span className="success-icon">✓</span>
            <span className="success-text">
              Note enregistrée dans {savedFolderName === "racine" ? "la racine" : `"${savedFolderName}"`} !
            </span>
          </div>
        </div>
      )}

      <div className="tool-bar" style={{
        padding: isMobile ? '12px 10px 16px 10px' : '12px 16px',
        gap: isMobile ? '8px' : '12px',
        minHeight: isMobile ? '68px' : '64px',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        alignItems: 'center',
        boxShadow: isMobile ? '0 -4px 12px rgba(0, 0, 0, 0.15)' : '0 -2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <ul className="tool-bar-list" style={{
          display: 'flex',
          gap: isMobile ? '8px' : '8px',
          flexWrap: 'nowrap',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          alignItems: 'center'
        }}>
          <li><button className="image" onClick={() => imageAction()} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/image.png" alt="Image" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button className="mind-map" onClick={() => setShowMindMapPopup(true)} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/mindmap.png" alt="Carte mentale" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('bold')} className={activeFormats.bold ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/bold.png" alt="Gras" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('italic')} className={activeFormats.italic ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/italic.png" alt="Italique" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('underline')} className={activeFormats.underline ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/underline.png" alt="Souligné" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('strike')} className={activeFormats.strike ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/strikethrough.png" alt="Barré" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('list', 'bullet')} className={activeFormats['list-bullet'] ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/bullet_list.png" alt="Liste à puces" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('list', 'ordered')} className={activeFormats['list-ordered'] ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/numbered_list.png" alt="Liste numérotée" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('header', 1)} className={activeFormats['header-1'] ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/h1.png" alt="Titre 1" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('header', 2)} className={activeFormats['header-2'] ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/h2.png" alt="Titre 2" style={{ width: '20px', height: '20px' }}/></button></li>
          
          <li><button onClick={() => handleFormat('header', 3)} className={activeFormats['header-3'] ? 'active' : ''} style={{ 
            minWidth: isMobile ? '48px' : '40px',
            minHeight: isMobile ? '48px' : '40px',
            padding: isMobile ? '12px' : '8px',
            borderRadius: isMobile ? '12px' : '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}><img src="img/h3.png" alt="Titre 3" style={{ width: '20px', height: '20px' }}/></button></li>
        </ul>
      </div>
    </div>
  );
}

// Rendu dom
ReactDOM.render(<App />, document.getElementById('root'));