const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');

// Load env vars
dotenv.config();

const usersData = [
  { name: 'Aisha', email: 'aisha@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Aisha' },
  { name: 'Rohan', email: 'rohan@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rohan' },
  { name: 'Priya', email: 'priya@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Priya' },
  { name: 'Meera', email: 'meera@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Meera' },
  { name: 'Dev', email: 'dev@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Dev' },
  { name: 'Sam', email: 'sam@example.com', password: 'password123', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sam' },
];

const seedDB = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker');
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Group.deleteMany({});
    await GroupMembership.deleteMany({});
    
    // Check if models exist before deleting to avoid errors
    const collections = mongoose.connection.collections;
    if (collections['expenses']) await collections['expenses'].deleteMany({});
    if (collections['splits']) await collections['splits'].deleteMany({});
    if (collections['settlements']) await collections['settlements'].deleteMany({});
    if (collections['comments']) await collections['comments'].deleteMany({});
    if (collections['importlogs']) await collections['importlogs'].deleteMany({});

    console.log('Cleared existing collections.');

    // Create users (using save() so the password hashing pre-save hook runs)
    const createdUsers = [];
    for (const u of usersData) {
      const newUser = new User(u);
      await newUser.save();
      createdUsers.push(newUser);
      console.log(`Seeded user: ${u.name}`);
    }

    const aisha = createdUsers.find(u => u.name === 'Aisha');
    const rohan = createdUsers.find(u => u.name === 'Rohan');
    const priya = createdUsers.find(u => u.name === 'Priya');
    const meera = createdUsers.find(u => u.name === 'Meera');
    const dev = createdUsers.find(u => u.name === 'Dev');
    const sam = createdUsers.find(u => u.name === 'Sam');

    // Create default group
    const group = await Group.create({
      name: 'Apartment 4B',
      category: 'Home',
      createdBy: aisha._id,
    });
    console.log(`Seeded group: ${group.name}`);

    // Create memberships with proper dates
    const memberships = [
      { group: group._id, user: aisha._id, role: 'admin', joinDate: new Date('2026-01-01') },
      { group: group._id, user: rohan._id, role: 'member', joinDate: new Date('2026-01-01') },
      { group: group._id, user: priya._id, role: 'member', joinDate: new Date('2026-01-01') },
      {
        group: group._id,
        user: meera._id,
        role: 'member',
        joinDate: new Date('2026-01-01'),
        leaveDate: new Date('2026-03-29T23:59:59'), // Meera left on Sunday Mar 29, 2026
      },
      { group: group._id, user: dev._id, role: 'member', joinDate: new Date('2026-01-01') },
      { group: group._id, user: sam._id, role: 'member', joinDate: new Date('2026-04-08') }, // Sam joins April 8, 2026
    ];

    await GroupMembership.insertMany(memberships);
    console.log('Seeded group memberships.');

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
