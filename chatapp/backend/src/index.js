import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

dotenv.config();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
  }
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
  })
);

app.use(express.json());


// ===============================
// USER MODEL
// ===============================

const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true
      },

      email: {
        type: String,
        unique: true,
        required: true
      },

      password: String,

      avatar: String,

      bio: {
        type: String,
        default: ''
      },

      lastSeen: Date
    },
    {
      timestamps: true
    }
  )
);


// ===============================
// MESSAGE MODEL
// ===============================

const Message = mongoose.model(
  'Message',
  new mongoose.Schema(
    {
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },

      to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },

      text: String,

      seen: {
        type: Boolean,
        default: false
      }
    },
    {
      timestamps: true
    }
  )
);


// ===============================
// JWT TOKEN
// ===============================

const token = (u) =>
  jwt.sign(
    {
      id: u._id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );


// ===============================
// HEALTH CHECK
// ===============================

app.get('/api/health', (_, res) => {
  res.json({
    ok: true
  });
});


// ===============================
// REGISTER
// ===============================

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }

    const existingUser = await User.findOne({
      email
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const u = await User.create({
      name,
      email,
      password: hashedPassword,

      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=7c3aed&color=fff`,

      bio: ''
    });

    res.status(201).json({
      token: token(u),

      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        bio: u.bio
      }
    });
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});


// ===============================
// LOGIN
// ===============================

app.post('/api/auth/login', async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    const u = await User.findOne({
      email
    });

    if (
      !u ||
      !(await bcrypt.compare(password, u.password))
    ) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    res.json({
      token: token(u),

      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        bio: u.bio
      }
    });
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});


// ===============================
// AUTH MIDDLEWARE
// ===============================

const auth = async (req, res, next) => {
  try {
    const t =
      req.headers.authorization?.split(' ')[1];

    req.user = jwt.verify(
      t,
      process.env.JWT_SECRET
    );

    next();
  } catch {
    res.status(401).json({
      message: 'Unauthorized'
    });
  }
};


// ===============================
// UPDATE PROFILE
// ===============================

app.put('/api/profile', auth, async (req, res) => {
  try {
    const {
      name,
      bio,
      avatar
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,

      {
        name,
        bio,
        avatar
      },

      {
        new: true
      }
    ).select('-password');

    res.json(user);
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});


// ===============================
// GET USERS
// ===============================

app.get('/api/users', auth, async (req, res) => {
  try {
    const q = req.query.q || '';

    const users = await User.find({
      _id: {
        $ne: req.user.id
      },

      name: {
        $regex: q,
        $options: 'i'
      }
    })
      .select(
        'name email avatar bio lastSeen'
      )
      .limit(30);

    res.json(users);
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});


// ===============================
// GET MESSAGES
// ===============================

app.get(
  '/api/messages/:id',
  auth,
  async (req, res) => {
    try {
      const msgs = await Message.find({
        $or: [
          {
            from: req.user.id,
            to: req.params.id
          },

          {
            from: req.params.id,
            to: req.user.id
          }
        ]
      }).sort('createdAt');

      // Mark received messages as seen
      await Message.updateMany(
        {
          from: req.params.id,
          to: req.user.id,
          seen: false
        },

        {
          $set: {
            seen: true
          }
        }
      );

      res.json(msgs);
    } catch (e) {
      res.status(500).json({
        message: e.message
      });
    }
  }
);


// ===============================
// SEND MESSAGE
// ===============================

app.post(
  '/api/messages',
  auth,
  async (req, res) => {
    try {
      const {
        to,
        text
      } = req.body;

      if (!to || !text?.trim()) {
        return res.status(400).json({
          message: 'Message required'
        });
      }

      const m = await Message.create({
        from: req.user.id,
        to,
        text: text.trim()
      });

      // Real-time message
      io
        .to(String(to))
        .emit('message:new', m);

      res.status(201).json(m);
    } catch (e) {
      res.status(500).json({
        message: e.message
      });
    }
  }
);


// ===============================
// SOCKET.IO
// ===============================

io.on('connection', (socket) => {

  // Join personal room
  socket.on('join', (id) => {
    socket.join(String(id));
  });


  // Typing
  socket.on(
    'typing',
    ({ to, from }) => {
      socket
        .to(String(to))
        .emit('typing', {
          from
        });
    }
  );


  // Stop typing
  socket.on(
    'stopTyping',
    ({ to, from }) => {
      socket
        .to(String(to))
        .emit('stopTyping', {
          from
        });
    }
  );


  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});


// ===============================
// SERVER + MONGODB
// ===============================

const port =
  process.env.PORT || 5000;

mongoose
  .connect(
    process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/nova-chat'
  )

  .then(() => {
    console.log(
      'MongoDB Connected Successfully'
    );

    server.listen(
      port,
      () => {
        console.log(
          `Server running on ${port}`
        );
      }
    );
  })

  .catch((e) => {
    console.error(
      'MongoDB connection failed:',
      e.message
    );
  });
const express = require('express');
const cors = require('cors');
const app = express();

// CORS কনফিগারেশন
app.use(cors({
  origin: 'https://nova-chat-mem-chat-app-itdz-71sz6cmsa-sangta-nayek.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
