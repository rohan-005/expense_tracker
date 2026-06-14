const User = require('../models/User');
const Group = require('../models/Group');
const GroupMembership = require('../models/GroupMembership');

const seedDemoData = async () => {
  try {
    const demoUsers = [
      { name: 'Aisha', email: 'aisha@example.com', password: 'password123' },
      { name: 'Rohan', email: 'rohan@example.com', password: 'password123' },
      { name: 'Priya', email: 'priya@example.com', password: 'password123' },
      { name: 'Meera', email: 'meera@example.com', password: 'password123' },
      { name: 'Dev',   email: 'dev@example.com',   password: 'password123' },
      { name: 'Sam',   email: 'sam@example.com',   password: 'password123' },
    ];

    const createdUsers = [];
    for (const u of demoUsers) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: {
          name: u.name,
          email: u.email,
          password: u.password,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.name)}`,
        },
      });
      createdUsers.push({ user, created });
      if (created) console.log(`[seed] Created user: ${u.name}`);
    }

    const aisha = createdUsers[0].user;

    // Seed group
    const [group, groupCreated] = await Group.findOrCreate({
      where: { name: 'Apartment 4B' },
      defaults: {
        name: 'Apartment 4B',
        category: 'Home',
        createdById: aisha.id,
        isActive: true,
      },
    });
    if (groupCreated) console.log('[seed] Created group: Apartment 4B');

    // Seed memberships
    const membershipDefs = [
      { user: createdUsers[0].user, role: 'admin',  joinDate: new Date('2026-01-01'), leaveDate: null },
      { user: createdUsers[1].user, role: 'member', joinDate: new Date('2026-01-01'), leaveDate: null },
      { user: createdUsers[2].user, role: 'member', joinDate: new Date('2026-01-01'), leaveDate: null },
      { user: createdUsers[3].user, role: 'member', joinDate: new Date('2026-01-01'), leaveDate: new Date('2026-03-29T18:29:59Z') },
      { user: createdUsers[4].user, role: 'member', joinDate: new Date('2026-01-01'), leaveDate: null },
      { user: createdUsers[5].user, role: 'member', joinDate: new Date('2026-04-08'), leaveDate: null },
    ];

    for (const m of membershipDefs) {
      const [, created] = await GroupMembership.findOrCreate({
        where: { groupId: group.id, userId: m.user.id },
        defaults: {
          groupId: group.id,
          userId: m.user.id,
          role: m.role,
          joinDate: m.joinDate,
          leaveDate: m.leaveDate,
        },
      });
      if (created) console.log(`[seed] Added ${m.user.name} to Apartment 4B`);
    }

    console.log('[seed] Demo data ready.');
  } catch (err) {
    console.error('[seed] Error seeding demo data:', err.message);
  }
};

module.exports = seedDemoData;
