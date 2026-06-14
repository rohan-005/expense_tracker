const { sequelize } = require('../config/db');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');

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
    console.log('Syncing database tables (force drop and recreate)...');
    await sequelize.sync({ force: true });
    console.log('Tables synced.');

    // Seed users using .create() so hooks (password hashing) run
    const createdUsers = [];
    for (const u of usersData) {
      const newUser = await User.create(u);
      createdUsers.push(newUser);
      console.log(`Seeded user: ${u.name}`);
    }

    const aisha = createdUsers.find(u => u.name === 'Aisha');
    const rohan = createdUsers.find(u => u.name === 'Rohan');
    const priya = createdUsers.find(u => u.name === 'Priya');
    const meera = createdUsers.find(u => u.name === 'Meera');
    const dev = createdUsers.find(u => u.name === 'Dev');
    const sam = createdUsers.find(u => u.name === 'Sam');

    // Create group
    const group = await Group.create({
      name: 'Apartment 4B',
      category: 'Home',
      createdById: aisha.id,
    });
    console.log(`Seeded group: ${group.name}`);

    // Create group memberships
    const memberships = [
      { groupId: group.id, userId: aisha.id, role: 'admin', joinDate: new Date('2026-01-01') },
      { groupId: group.id, userId: rohan.id, role: 'member', joinDate: new Date('2026-01-01') },
      { groupId: group.id, userId: priya.id, role: 'member', joinDate: new Date('2026-01-01') },
      {
        groupId: group.id,
        userId: meera.id,
        role: 'member',
        joinDate: new Date('2026-01-01'),
        leaveDate: new Date('2026-03-29T23:59:59'), // Meera left on Sunday Mar 29, 2026
      },
      { groupId: group.id, userId: dev.id, role: 'member', joinDate: new Date('2026-01-01') },
      { groupId: group.id, userId: sam.id, role: 'member', joinDate: new Date('2026-04-08') }, // Sam joins April 8, 2026
    ];

    await GroupMembership.bulkCreate(memberships);
    console.log('Seeded group memberships.');

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
