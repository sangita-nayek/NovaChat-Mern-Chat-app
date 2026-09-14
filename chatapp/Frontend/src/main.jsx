import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  Send,
  Search,
  Sun,
  Moon,
  Paperclip,
  Smile,
  MessageCircle,
  LogOut,
  User,
  X,
  Camera,
  Palette
} from 'lucide-react';

import './style.css';

const API = 'http://localhost:5000/api';

let socket;


// ======================================
// AUTH
// ======================================

function Auth({ onLogin }) {

  const [mode, setMode] = useState('login');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [err, setErr] = useState('');

  const submit = async (e) => {

    e.preventDefault();

    try {

      const r = await axios.post(
        `${API}/auth/${mode}`,
        form
      );

      localStorage.setItem(
        'nova',
        JSON.stringify(r.data)
      );

      onLogin(r.data);

    } catch (x) {

      setErr(
        x.response?.data?.message ||
        'Something went wrong'
      );
    }
  };


  return (
    <div className="auth">

      <div className="auth-card">

        <div className="logo">
          <span>✦</span>
            NovaChat
        </div>

        <p className="muted">
          Fast, private conversations.
        </p>

        <h1>
          {mode === 'login'
            ? 'Welcome back'
            : 'Create your account'}
        </h1>


        {mode === 'register' && (

          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value
              })
            }
          />

        )}


        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value
            })
          }
        />


        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value
            })
          }
        />


        {err && (
          <div className="error">
            {err}
          </div>
        )}


        <button
          className="primary"
          onClick={submit}
        >
          {mode === 'login'
            ? 'Sign in'
            : 'Sign up'}
        </button>


        <button
          className="link"
          onClick={() => {
            setMode(
              mode === 'login'
                ? 'register'
                : 'login'
            );

            setErr('');
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>

      </div>

    </div>
  );
}


// ======================================
// CHAT APP
// ======================================

function App({ data, onLogout }) {

  const [user, setUser] = useState(data.user);

  const [users, setUsers] = useState([]);

  const [selected, setSelected] =
    useState(null);

  const [msgs, setMsgs] =
    useState([]);

  const [text, setText] =
    useState('');

  const [query, setQuery] =
    useState('');

  const [typing, setTyping] =
    useState(false);

  const [dark, setDark] =
    useState(
      localStorage.getItem('dark') === '1'
    );


  // PROFILE MODAL

  const [showProfile, setShowProfile] =
    useState(false);


  const [profileName, setProfileName] =
    useState(user.name || '');


  const [profileBio, setProfileBio] =
    useState(user.bio || '');


  const [profileAvatar, setProfileAvatar] =
    useState(user.avatar || '');


  // THEME

  const [theme, setTheme] =
    useState(
      localStorage.getItem('theme') ||
      'purple'
    );


  const themes = {
    purple: '#7c3aed',
    blue: '#2563eb',
    pink: '#db2777',
    green: '#16a34a',
    orange: '#ea580c'
  };


  const headers = {
    Authorization:
      `Bearer ${data.token}`
  };


  // ======================================
  // SOCKET
  // ======================================

  useEffect(() => {

    socket = io('http://localhost:5000');

    socket.emit(
      'join',
      user.id
    );


    socket.on(
      'message:new',
      (m) => {

        if (
          String(m.from) ===
          String(selected?._id)
        ) {

          setMsgs((v) => [
            ...v,
            m
          ]);

        }

      }
    );


    socket.on(
      'typing',
      (p) => {

        if (
          String(p.from) ===
          String(selected?._id)
        ) {

          setTyping(true);

        }

      }
    );


    socket.on(
      'stopTyping',
      (p) => {

        if (
          !selected ||
          String(p.from) ===
          String(selected._id)
        ) {

          setTyping(false);

        }

      }
    );


    return () => {

      socket.disconnect();

    };

  }, [user.id, selected]);


  // ======================================
  // GET USERS
  // ======================================

  useEffect(() => {

    axios
      .get(
        `${API}/users?q=${encodeURIComponent(query)}`,
        { headers }
      )

      .then((r) => {

        setUsers(r.data);

      })

      .catch((err) => {

        console.log(
          'Users error:',
          err
        );

      });

  }, [query]);


  // ======================================
  // GET MESSAGES
  // ======================================

  useEffect(() => {

    if (!selected) return;

    axios
      .get(
        `${API}/messages/${selected._id}`,
        { headers }
      )

      .then((r) => {

        setMsgs(r.data);

      })

      .catch((err) => {

        console.log(
          'Messages error:',
          err
        );

      });

  }, [selected]);


  // ======================================
  // SEND MESSAGE
  // ======================================

  const send = async () => {

    if (
      !text.trim() ||
      !selected
    ) {
      return;
    }


    try {

      const r =
        await axios.post(
          `${API}/messages`,
          {
            to: selected._id,
            text
          },
          { headers }
        );


      setMsgs((v) => [
        ...v,
        r.data
      ]);


      setText('');


      socket.emit(
        'stopTyping',
        {
          to: selected._id,
          from: user.id
        }
      );

    } catch (err) {

      console.log(
        'Send message error:',
        err
      );

    }

  };


  // ======================================
  // PROFILE PHOTO
  // ======================================

  const handleAvatarChange = (e) => {

    const file =
      e.target.files?.[0];

    if (!file) return;


    if (file.size > 1024 * 1024) {

      alert(
        'Please choose an image smaller than 1MB.'
      );

      return;

    }


    const reader =
      new FileReader();


    reader.onload = () => {

      setProfileAvatar(
        reader.result
      );

    };


    reader.readAsDataURL(file);

  };


  // ======================================
  // SAVE PROFILE
  // ======================================

  const saveProfile = async () => {

    try {

      const r =
        await axios.put(
          `${API}/profile`,
          {
            name: profileName,
            bio: profileBio,
            avatar: profileAvatar
          },
          { headers }
        );


      const updatedUser = {
        ...user,
        name: r.data.name,
        bio: r.data.bio,
        avatar: r.data.avatar
      };


      setUser(updatedUser);


      const updatedData = {
        ...data,
        user: updatedUser
      };


      localStorage.setItem(
        'nova',
        JSON.stringify(updatedData)
      );


      setShowProfile(false);


      // refresh user list
      const usersResponse =
        await axios.get(
          `${API}/users`,
          { headers }
        );

      setUsers(
        usersResponse.data
      );

    } catch (err) {

      console.log(
        'Profile update error:',
        err
      );

      alert(
        err.response?.data?.message ||
        'Profile update failed'
      );

    }

  };


  // ======================================
  // CHANGE THEME
  // ======================================

  const changeTheme = (color) => {

    setTheme(color);

    localStorage.setItem(
      'theme',
      color
    );

  };


  // ======================================
  // LOGOUT
  // ======================================

  const logout = () => {

    localStorage.removeItem(
      'nova'
    );

    onLogout();

  };


  return (

    <div
      className={
        dark
          ? 'app dark'
          : 'app'
      }

      style={{
        '--theme-color':
          themes[theme]
      }}
    >


      {/* =================================
          SIDEBAR
      ================================= */}

      <aside>

        <div className="brand">

          <div className="logo">

            <span>✦</span>

            NovaChat

          </div>


          <div className="brand-actions">

            <button
              className="icon"
              title="Theme"
              onClick={() =>
                changeTheme(
                  theme === 'purple'
                    ? 'blue'
                    : theme === 'blue'
                    ? 'pink'
                    : theme === 'pink'
                    ? 'green'
                    : theme === 'green'
                    ? 'orange'
                    : 'purple'
                )
              }
            >

              <Palette size={18} />

            </button>


            <button
              className="icon"
              onClick={() => {

                setDark(!dark);

                localStorage.setItem(
                  'dark',
                  dark ? '0' : '1'
                );

              }}
            >

              {dark
                ? <Sun size={18} />
                : <Moon size={18} />
              }

            </button>

          </div>

        </div>


        {/* =================================
            CURRENT USER
        ================================= */}

        <div className="me">

          <img
            src={user.avatar}
            alt="profile"
          />


          <div>

            <b>
              {user.name}
            </b>

            <small>
              ● Online
            </small>

          </div>


          <button
            className="icon"
            title="Profile"
            onClick={() => {

              setProfileName(
                user.name || ''
              );

              setProfileBio(
                user.bio || ''
              );

              setProfileAvatar(
                user.avatar || ''
              );

              setShowProfile(true);

            }}
          >

            <User size={18} />

          </button>


          <button
            className="icon"
            title="Logout"
            onClick={logout}
          >

            <LogOut size={18} />

          </button>

        </div>


        {/* =================================
            SEARCH
        ================================= */}

        <div className="search">

          <Search size={17} />

          <input
            placeholder="Search people..."
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
          />

        </div>


        {/* =================================
            PEOPLE
        ================================= */}

        <div className="people">

          {users.map((u) => (

            <button
              className={
                selected?._id === u._id
                  ? 'person active'
                  : 'person'
              }

              key={u._id}

              onClick={() => {

                setSelected(u);

                setTyping(false);

              }}
            >

              <img
                src={u.avatar}
                alt={u.name}
              />


              <div>

                <b>
                  {u.name}
                </b>

                <small>
                  {u.bio ||
                    u.email}
                </small>

              </div>


              <i>
                ●
              </i>

            </button>

          ))}

        </div>

      </aside>


      {/* =================================
          MAIN CHAT
      ================================= */}

      <main>

        {selected ? (

          <>

            {/* HEADER */}

            <header>

              <img
                src={selected.avatar}
                alt={selected.name}
              />


              <div>

                <h3>
                  {selected.name}
                </h3>

                <span>

                  {typing
                    ? 'typing...'
                    : 'Active now'}

                </span>

              </div>

            </header>


            {/* MESSAGES */}

            <section className="messages">

              {msgs.map((m) => (

                <div
                  className={
                    String(m.from) ===
                    String(user.id)
                      ? 'bubble mine'
                      : 'bubble'
                  }

                  key={m._id}
                >

                  <p>
                    {m.text}
                  </p>


                  <small>

                    {new Date(
                      m.createdAt
                    ).toLocaleTimeString(
                      [],
                      {
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    )}


                    {' '}


                    {String(m.from) ===
                      String(user.id) && (

                      m.seen
                        ? '✓✓'
                        : '✓'

                    )}

                  </small>

                </div>

              ))}


              {typing && (

                <div className="typing">

                  {selected.name}
                  {' '}
                  is typing…

                </div>

              )}

            </section>


            {/* MESSAGE INPUT */}

            <footer>

              <button
                className="icon"
                title="Attachment"
              >

                <Paperclip />

              </button>


              <input
                value={text}

                onChange={(e) => {

                  setText(
                    e.target.value
                  );


                  socket.emit(
                    'typing',
                    {
                      to: selected._id,
                      from: user.id
                    }
                  );

                }}

                onKeyDown={(e) => {

                  if (
                    e.key === 'Enter'
                  ) {

                    send();

                  }

                }}

                placeholder="Write a message..."
              />


              <button
                className="icon"
                title="Emoji"
              >

                <Smile />

              </button>


              <button
                className="send"
                onClick={send}
              >

                <Send size={18} />

              </button>

            </footer>

          </>

        ) : (

          <div className="empty">

            <MessageCircle
              size={56}
            />

            <h2>
              Your conversations
            </h2>

            <p>
              Select someone from the
              left to start chatting.
            </p>

          </div>

        )}

      </main>


      {/* =================================
          PROFILE MODAL
      ================================= */}

      {showProfile && (

        <div className="modal-overlay">

          <div className="profile-modal">


            <button
              className="modal-close"
              onClick={() =>
                setShowProfile(false)
              }
            >

              <X size={20} />

            </button>


            <h2>
              My Profile
            </h2>


            <div className="profile-photo-area">

              <img
                src={
                  profileAvatar ||
                  'https://ui-avatars.com/api/?name=User'
                }

                alt="profile"
                className="profile-photo"
              />


              <label className="camera-button">

                <Camera size={17} />

                <input
                  type="file"
                  accept="image/*"
                  onChange={
                    handleAvatarChange
                  }
                />

              </label>

            </div>


            <label>
              Name
            </label>

            <input
              className="profile-input"
              value={profileName}
              onChange={(e) =>
                setProfileName(
                  e.target.value
                )
              }
              placeholder="Your name"
            />


            <label>
              Bio
            </label>

            <textarea
              className="profile-input profile-textarea"
              value={profileBio}
              onChange={(e) =>
                setProfileBio(
                  e.target.value
                )
              }
              placeholder="Write something about yourself..."
              maxLength={150}
            />


            <small className="bio-count">

              {profileBio.length}/150

            </small>


            <button
              className="save-profile"
              onClick={saveProfile}
            >

              Save Profile

            </button>

          </div>

        </div>

      )}

    </div>

  );

}


// ======================================
// ROOT
// ======================================

function Root() {

  const [data, setData] =
    useState(() =>
      JSON.parse(
        localStorage.getItem(
          'nova'
        ) || 'null'
      )
    );


  return data ? (

    <App
      data={data}
      onLogout={() => {

        localStorage.removeItem(
          'nova'
        );

        setData(null);

      }}
    />

  ) : (

    <Auth
      onLogin={setData}
    />

  );

}


createRoot(
  document.getElementById('root')
).render(
  <Root />
);