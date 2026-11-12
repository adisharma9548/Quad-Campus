import type { DatabaseSync } from 'node:sqlite';
import {
  ADMIN_EMAIL,
  ADMIN_USERNAME,
  DEFAULT_GROUPS,
  INSTITUTION,
  SEED_ADMIN_PASSWORD,
  SEED_ADMIN_PASSWORD_GENERATED,
  SEED_DEMO_DATA,
  SEED_STUDENT_PASSWORD,
} from '../config/constants.ts';
import type { UserRole, UserStatus } from '../types.ts';
import { hashPassword } from '../utils/crypto.ts';

const HOURS = 3600 * 1000;
const DAYS = 24 * HOURS;

interface SeedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  dob: string;
  department: string;
  year: string;
  section: string;
  branch: string;
  bio: string;
  avatarInitials: string;
  interests: string[];
  profilePublic: number;
  discoverable: number;
  suspendedUntil?: string;
  suspensionReason?: string;
  bannedAt?: string;
  banReason?: string;
  passwordHash: string;
}

/**
 * Production bootstrap: creates ONLY the first administrator, and only when SEED_ADMIN_PASSWORD
 * was set explicitly to a strong value (12+ characters). No demo content, no known passwords.
 */
async function bootstrapAdminOnly(db: DatabaseSync): Promise<boolean> {
  if (SEED_ADMIN_PASSWORD_GENERATED || SEED_ADMIN_PASSWORD.length < 12) return false;
  const program = INSTITUTION.programs[0]!;
  const hash = await hashPassword(SEED_ADMIN_PASSWORD);
  db.prepare(`
    INSERT INTO users (
      id, username, email, role, status, full_name, dob, department, year, section, branch,
      bio, avatar_initials, interests_json, profile_public, discoverable, password_hash, created_at
    ) VALUES (?, ?, ?, 'admin', 'active', ?, '', ?, ?, ?, ?, '', 'AD', '[]', 0, 0, ?, ?)
  `).run(
    'usr_admin_master',
    ADMIN_USERNAME,
    ADMIN_EMAIL,
    'Administrator',
    program.name,
    INSTITUTION.years[0]!,
    INSTITUTION.sections[0]!,
    program.code,
    hash,
    new Date().toISOString()
  );
  for (const g of DEFAULT_GROUPS) {
    db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)').run(
      'usr_admin_master',
      g
    );
  }
  return true;
}

/** Returns true when the database was empty and has just been seeded. */
export async function seedDatabase(db: DatabaseSync): Promise<boolean> {
  const countRow = db
    .prepare('SELECT COUNT(*) AS count FROM users')
    .get() as { count: number } | undefined;
  const existingCount = Number(countRow?.count || 0);
  if (existingCount > 0) return false;
  if (!SEED_DEMO_DATA) return bootstrapAdminOnly(db);

  const now = Date.now();
  const adminHash = await hashPassword(SEED_ADMIN_PASSWORD);
  const studentHash = await hashPassword(SEED_STUDENT_PASSWORD);

  const seedUsers: SeedUser[] = [
    {
      id: 'usr_admin_master',
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      status: 'active',
      fullName: 'Campus System Administrator',
      dob: '1998-01-01',
      department: 'Computer Science & Engineering - Computer Science',
      year: '4th Year',
      section: 'A',
      branch: 'CSE',
      bio: 'Campus security auditor & moderation administrator.',
      avatarInitials: 'AD',
      interests: ['Cybersecurity', 'Systems'],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: adminHash,
    },
    {
      id: 'usr_seed_quantum_dev',
      username: 'quantum_dev',
      email: 'aarav.patel@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Aarav Patel',
      dob: '2004-06-15',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'A',
      branch: 'CSE',
      bio: 'CS junior exploring distributed systems and compilers. Building quiet software on campus.',
      avatarInitials: 'QD',
      interests: ['Algorithms', 'Compilers', 'Systems', 'Embedded'],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
    {
      id: 'usr_seed_cyber_sage',
      username: 'cyber_sage',
      email: 'rohan.verma@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Rohan Verma',
      dob: '2004-09-21',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'B',
      branch: 'CSE',
      bio: 'Security researcher & systems programmer.',
      avatarInitials: 'CS',
      interests: ['Cybersecurity', 'Linux', 'Systems'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_code_wizard',
      username: 'code_wizard',
      email: 'code.wizard@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Kabir Mehta',
      dob: '2004-04-12',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'A',
      branch: 'CSE',
      bio: 'Algorithms TA & graph theory enthusiast.',
      avatarInitials: 'CW',
      interests: ['DSA', 'Algorithms', 'CSELab'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_chai_coder',
      username: 'chai_coder',
      email: 'chai.coder@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Ananya Rao',
      dob: '2004-11-08',
      department: 'Computer Science & Engineering - Internet of Things',
      year: '3rd Year',
      section: 'C',
      branch: 'IoT',
      bio: 'Embedded systems & quiet study spot explorer.',
      avatarInitials: 'CC',
      interests: ['CampusTips', 'StudySpots', 'IoT'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_robo_racer',
      username: 'robo_racer',
      email: 'robo.racer@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Vikram Nair',
      dob: '2003-03-19',
      department: 'Mechanical Engineering',
      year: '4th Year',
      section: 'A',
      branch: 'ME',
      bio: 'Autonomous systems & controls lead.',
      avatarInitials: 'RR',
      interests: ['RoboticsLab', 'Embedded', 'Controls'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_data_dreamer',
      username: 'data_dreamer',
      email: 'data.dreamer@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Meera Iyer',
      dob: '2004-07-23',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'B',
      branch: 'CSE',
      bio: 'Maintaining open B.Tech study archives.',
      avatarInitials: 'DD',
      interests: ['EndSemPrep', 'StudyArchive', 'Databases'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_kernel_kid',
      username: 'kernel_kid',
      email: 'kernel.kid@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Siddharth Joshi',
      dob: '2005-01-14',
      department: 'Information Technology',
      year: '2nd Year',
      section: 'A',
      branch: 'IT',
      bio: 'Edge compute, Linux kernel, and C.',
      avatarInitials: 'KK',
      interests: ['HackathonTeams', 'RoboticsLab', 'Linux'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_algo_ninja',
      username: 'algo_ninja',
      email: 'algo.ninja@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Ishaan Kulkarni',
      dob: '2005-05-30',
      department: 'Computer Science & Engineering - Data Science',
      year: '2nd Year',
      section: 'D',
      branch: 'DS',
      bio: 'Statistics, competitive programming, and ML.',
      avatarInitials: 'AN',
      interests: ['Algorithms', 'DSA', 'DataScience'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_debug_queen',
      username: 'debug_queen',
      email: 'debug.queen@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Neha Sharma',
      dob: '2003-08-02',
      department: 'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
      year: '4th Year',
      section: 'A',
      branch: 'AI/ML',
      bio: 'Computer vision research & mentoring.',
      avatarInitials: 'DQ',
      interests: ['AI', 'Systems', 'Compilers'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_green_circuit',
      username: 'green_circuit',
      email: 'green.circuit@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Aditya Menon',
      dob: '2005-02-17',
      department: 'Computer Science & Engineering - Internet of Things',
      year: '2nd Year',
      section: 'B',
      branch: 'IoT',
      bio: 'Solar energy harvesting & PCB design.',
      avatarInitials: 'GC',
      interests: ['IoTLab', 'Embedded', 'Hardware'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_ai_architect',
      username: 'ai_architect',
      email: 'ai.architect@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Priya Nair',
      dob: '2004-10-03',
      department: 'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
      year: '3rd Year',
      section: 'A',
      branch: 'AI/ML',
      bio: 'Quantized local inference & computer vision.',
      avatarInitials: 'AA',
      interests: ['AI', 'ML', 'Systems'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_drone_pilot',
      username: 'drone_pilot',
      email: 'drone.pilot@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Karan Deshmukh',
      dob: '2004-12-28',
      department: 'Mechanical Engineering',
      year: '3rd Year',
      section: 'C',
      branch: 'ME',
      bio: 'Flight controllers & PID stabilization.',
      avatarInitials: 'DP',
      interests: ['Aerospace', 'RoboticsLab'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_pixel_punk',
      username: 'pixel_punk',
      email: 'pixel.punk@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Devika Sen',
      dob: '2004-06-11',
      department: 'Mechanical Engineering',
      year: '3rd Year',
      section: 'E',
      branch: 'ME',
      bio: 'CAD prototyping & campus makerspace.',
      avatarInitials: 'PP',
      interests: ['CAD', 'Makerspace'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_compiler_fan',
      username: 'compiler_fan',
      email: 'compiler.fan@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Tanmay Gupta',
      dob: '2004-04-04',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'A',
      branch: 'CSE',
      bio: 'Parsers, LLVM, and type systems.',
      avatarInitials: 'CF',
      interests: ['Compilers', 'Systems'],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
    {
      id: 'usr_binary_bard',
      username: 'binary_bard',
      email: 'binary.bard@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Nikhil Bhat',
      dob: '2003-09-09',
      department: 'Computer Science & Engineering - Computer Science',
      year: '4th Year',
      section: 'B',
      branch: 'CSE',
      bio: 'Compilers & programming languages.',
      avatarInitials: 'BB',
      interests: ['Compilers', 'C++'],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
    {
      id: 'usr_gate_aspirant',
      username: 'gate_aspirant',
      email: 'gate.aspirant@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Shruti Roy',
      dob: '2004-02-22',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'D',
      branch: 'CSE',
      bio: 'Computer architecture & OS study circles.',
      avatarInitials: 'GA',
      interests: ['EndSemPrep', 'Architecture'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_tech_titan',
      username: 'tech_titan',
      email: 'tech.titan@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Arjun Malhotra',
      dob: '2004-03-11',
      department: 'Computer Science & Engineering - Computer Science',
      year: '3rd Year',
      section: 'F',
      branch: 'CSE',
      bio: 'Backend infrastructure & systems.',
      avatarInitials: 'TT',
      interests: ['Systems', 'Backend'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_ml_maven',
      username: 'ml_maven',
      email: 'ml.maven@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Zoya Khan',
      dob: '2004-08-19',
      department: 'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
      year: '3rd Year',
      section: 'B',
      branch: 'AI/ML',
      bio: 'Computer vision research & models.',
      avatarInitials: 'MM',
      interests: ['AI', 'Vision'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_web_weaver',
      username: 'web_weaver',
      email: 'web.weaver@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Rhea Kapoor',
      dob: '2005-04-07',
      department: 'Information Technology',
      year: '2nd Year',
      section: 'B',
      branch: 'IT',
      bio: 'Full-stack web & security.',
      avatarInitials: 'WW',
      interests: ['Web', 'Cybersecurity'],
      profilePublic: 0,
      discoverable: 1,
      passwordHash: studentHash,
    },
    {
      id: 'usr_anonymous_cadet',
      username: 'anonymous_cadet',
      email: 'cadet.mech@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Hostel Cadet',
      dob: '2004-01-30',
      department: 'Mechanical Engineering',
      year: '3rd Year',
      section: 'G',
      branch: 'ME',
      bio: 'Workshop team member.',
      avatarInitials: 'AC',
      interests: ['Workshop'],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
    {
      id: 'usr_spammer_99',
      username: 'usr_spammer_99',
      email: 'spam.account99@btech.college.edu.in',
      role: 'student',
      status: 'suspended',
      fullName: 'External Deals Bot',
      dob: '2004-05-05',
      department: 'Information Technology',
      year: '2nd Year',
      section: 'H',
      branch: 'IT',
      bio: 'Suspended test account.',
      avatarInitials: 'US',
      interests: [],
      profilePublic: 0,
      discoverable: 0,
      suspendedUntil: new Date(now + 7 * DAYS).toISOString(),
      suspensionReason: 'Pending commercial spam investigation',
      passwordHash: studentHash,
    },
    {
      id: 'usr_toxic_troll',
      username: 'toxic_troll',
      email: 'toxic.troll@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Test Blocked User 1',
      dob: '2004-05-06',
      department: 'Civil Engineering',
      year: '2nd Year',
      section: 'A',
      branch: 'CE',
      bio: '',
      avatarInitials: 'TT',
      interests: [],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
    {
      id: 'usr_spam_bot_99',
      username: 'spam_bot_99',
      email: 'spam.bot99@btech.college.edu.in',
      role: 'student',
      status: 'banned',
      fullName: 'Spam Account',
      dob: '2004-05-07',
      department: 'Electrical & Electronics Engineering',
      year: '1st Year',
      section: 'A',
      branch: 'EEE',
      bio: '',
      avatarInitials: 'SB',
      interests: [],
      profilePublic: 0,
      discoverable: 0,
      bannedAt: new Date(now - 30 * DAYS).toISOString(),
      banReason: 'Assignment promo spam',
      passwordHash: studentHash,
    },
    {
      id: 'usr_noise_maker',
      username: 'noise_maker',
      email: 'noise.maker@btech.college.edu.in',
      role: 'student',
      status: 'active',
      fullName: 'Muted Demo User',
      dob: '2004-05-08',
      department: 'Electronics & Communication Engineering',
      year: '2nd Year',
      section: 'A',
      branch: 'ECE',
      bio: '',
      avatarInitials: 'NM',
      interests: [],
      profilePublic: 0,
      discoverable: 0,
      passwordHash: studentHash,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, email, role, status, full_name, dob, department, year, section, branch,
      bio, avatar_initials, interests_json, profile_public, discoverable, suspended_until,
      suspension_reason, banned_at, ban_reason, password_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of seedUsers) {
    insertUser.run(
      u.id,
      u.username,
      u.email,
      u.role,
      u.status,
      u.fullName,
      u.dob,
      u.department,
      u.year,
      u.section,
      u.branch,
      u.bio,
      u.avatarInitials,
      JSON.stringify(u.interests || []),
      u.profilePublic ? 1 : 0,
      u.discoverable ? 1 : 0,
      u.suspendedUntil || null,
      u.suspensionReason || null,
      u.bannedAt || null,
      u.banReason || null,
      u.passwordHash,
      new Date(now - 20 * DAYS).toISOString()
    );
  }

  // Default custom groups for quantum_dev
  const insertGroup = db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)');
  for (const g of DEFAULT_GROUPS) {
    insertGroup.run('usr_seed_quantum_dev', g);
  }

  // Follow relationships:
  // Approved followers OF quantum_dev (can see quantum_dev's Personal Space posts matching groups)
  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)'
  );
  insertFollow.run('usr_seed_cyber_sage', 'usr_seed_quantum_dev', 'Close Friends', new Date(now - 10 * DAYS).toISOString());
  insertFollow.run('usr_algo_ninja', 'usr_seed_quantum_dev', 'My Year', new Date(now - 8 * DAYS).toISOString());
  insertFollow.run('usr_kernel_kid', 'usr_seed_quantum_dev', 'Classmates', new Date(now - 5 * DAYS).toISOString());
  // quantum_dev follows debug_queen & chai_coder
  insertFollow.run('usr_seed_quantum_dev', 'usr_debug_queen', 'Others', new Date(now - 7 * DAYS).toISOString());
  insertFollow.run('usr_seed_quantum_dev', 'usr_chai_coder', 'Others', new Date(now - 6 * DAYS).toISOString());

  // Pending follow requests to quantum_dev
  const insertReq = db.prepare(
    'INSERT OR IGNORE INTO follow_requests (id, requester_id, target_id, status, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertReq.run('req_1', 'usr_code_wizard', 'usr_seed_quantum_dev', 'pending', now - 2 * HOURS, new Date(now - 2 * HOURS).toISOString());
  insertReq.run('req_2', 'usr_debug_queen', 'usr_seed_quantum_dev', 'pending', now - 5 * HOURS, new Date(now - 5 * HOURS).toISOString());
  insertReq.run('req_3', 'usr_algo_ninja', 'usr_seed_quantum_dev', 'pending', now - 1 * DAYS, new Date(now - 1 * DAYS).toISOString());
  insertReq.run('req_4', 'usr_pixel_punk', 'usr_seed_quantum_dev', 'pending', now - 2 * DAYS, new Date(now - 2 * DAYS).toISOString());

  // Blocks & mutes for quantum_dev
  const insertBlock = db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)');
  insertBlock.run('usr_seed_quantum_dev', 'usr_toxic_troll', 'Unwanted messaging', new Date(now - 14 * DAYS).toISOString());
  insertBlock.run('usr_seed_quantum_dev', 'usr_spam_bot_99', 'Assignment promo spam', new Date(now - 30 * DAYS).toISOString());

  const insertMute = db.prepare('INSERT OR IGNORE INTO mutes (muter_id, muted_id, created_at) VALUES (?, ?, ?)');
  insertMute.run('usr_seed_quantum_dev', 'usr_noise_maker', new Date(now - 7 * DAYS).toISOString());

  // This week calendar events
  const insertEvent = db.prepare(
    'INSERT OR IGNORE INTO this_week_events (id, date_label, title, location, type, details, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertEvent.run(
    'tw-1',
    'Thu, Nov 14 • 5:30 PM',
    'Compiler Design Lab Viva & CFG Checkoff',
    'CS Lab 2, Academic Block A',
    'Lab Exam',
    'Bring lab manual and git commit hash for lexical & LL(1) parser milestones. Pseudonymous seating list posted inside Department noticeboard.',
    1
  );
  insertEvent.run(
    'tw-2',
    'Fri, Nov 15 • 11:59 PM',
    'Inter-College Hardware Hackathon Team Freeze',
    'Innovation Workbench Portal',
    'Deadline',
    'Final cutoff for 4-student cross-branch team registration and hardware BOM requisition forms.',
    2
  );
  insertEvent.run(
    'tw-3',
    'Sat, Nov 16 • 6:00 PM',
    'Edge AI & Autonomous Rover Live Bench Demo',
    'Seminar Bay B',
    'Event',
    'Open campus showcase by 3rd and 4th year Systems & Robotics peers. No photography rule enforced for unblurred faces.',
    3
  );

  // Seed Public + Personal + Flagged Posts
  const insertPost = db.prepare(`
    INSERT INTO posts (
      id, author_id, type, title, content, space, audience, group_name, hashtags_json,
      has_image, media_key, location, image_alt, best_answer_id, shares_count, status,
      created_at_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'post_1',
    'usr_code_wizard',
    'Discussion',
    'Topological ordering makes DSA lab graph recursion click',
    'Just wrapped up the DSA lab session in CS Lab 2. The directed acyclic graph recursion problem was surprisingly clean once you compute in-degrees up front and maintain a Kahn queue instead of chasing recursive cycle states. Sharing my whiteboard trace notes with the batch — happy to walk through edge cases after the 4 PM tutorial if anyone is stuck on disconnected components or weighted tie-breaking.',
    'public',
    'public',
    '',
    JSON.stringify(['#DSA', '#Algorithms', '#CSELab']),
    0,
    '',
    '',
    '',
    null,
    3,
    'active',
    now - 25 * 60 * 1000,
    new Date(now - 25 * 60 * 1000).toISOString()
  );

  insertPost.run(
    'post_2',
    'usr_chai_coder',
    'Tip',
    'Best quiet desk spots with wired Ethernet after 5 PM',
    'Quiet study tip for anyone pulling evening project sessions: the second-floor reading wing in Block C has working wired Ethernet ports along the north wall and almost zero foot traffic after 5 PM. Great Wi-Fi backup when uploading container images or syncing large datasets.',
    'public',
    'year',
    '',
    JSON.stringify(['#CampusTips', '#StudySpots']),
    1,
    'library',
    'Library Hall, East Wing',
    'Second floor desk setup with laptop, stacked textbooks, and wired wall Ethernet jack inside Library Hall East Wing',
    null,
    9,
    'active',
    now - 1 * HOURS,
    new Date(now - 1 * HOURS).toISOString()
  );

  insertPost.run(
    'post_3',
    'usr_seed_quantum_dev',
    'Question',
    'ESP32 serial sync timeout after new IoT lab firmware update?',
    'Has anyone encountered issues flashing the ESP32 DevKit v1 boards in the embedded lab after updating the SDK? I keep hitting a serial packet header timeout at 115200 baud unless I hold the BOOT button continuously until esptool connects, even with the 10uF capacitor across EN and GND.',
    'public',
    'branch',
    '',
    JSON.stringify(['#ESP32', '#IoTLab', '#Embedded']),
    0,
    '',
    '',
    '',
    null,
    1,
    'active',
    now - 2 * HOURS,
    new Date(now - 2 * HOURS).toISOString()
  );

  insertPost.run(
    'post_4',
    'usr_robo_racer',
    'Update',
    'Mechanical Workshop laser cutter maintenance moved to Thursday 2 PM',
    'Heads up for rover and drone teams booking laser cutting slots this week: optics alignment starts Thursday at 2:00 PM instead of Wednesday morning. Move any acrylic chassis DXF jobs to morning slots or book Bay 2.',
    'public',
    'public',
    '',
    JSON.stringify(['#RoboticsLab', '#WorkshopUpdate']),
    0,
    '',
    '',
    '',
    null,
    7,
    'active',
    now - 3 * HOURS,
    new Date(now - 3 * HOURS).toISOString()
  );

  insertPost.run(
    'post_5',
    'usr_data_dreamer',
    'Resource',
    '2025 End-Term B.Tech PYQ archive with worked solutions uploaded',
    'The student-curated Open Access archive for previous year B.Tech question papers has been refreshed with 2025 end-term solutions for Operating Systems, Computer Networks, Compiler Design, and Database Systems. Includes marking rubrics, anonymized topper scripts, and formula sheets for quick revision before internals start next Monday.',
    'public',
    'public',
    '',
    JSON.stringify(['#EndSemPrep', '#StudyArchive']),
    0,
    '',
    '',
    '',
    null,
    34,
    'active',
    now - 4 * HOURS,
    new Date(now - 4 * HOURS).toISOString()
  );

  insertPost.run(
    'post_6',
    'usr_kernel_kid',
    'Event',
    'Hardware Systems & Edge AI Demo Night — Open Bench Session',
    'Bringing three Jetson Orin Nano test rigs and logic analyzers to Seminar Bay B this Friday at 6 PM. Open demo night for 2nd and 3rd year teams benchmarking INT8 quantization, custom CAN bus telemetry, and PCB fault debugging before inter-college showcase submissions close.',
    'public',
    'public',
    '',
    JSON.stringify(['#HackathonTeams', '#RoboticsLab']),
    1,
    'hardware',
    'Innovation Workbench, Block A',
    'Embedded hardware testbench showing microcontroller module, logic analyzer block, and telemetry readout card',
    null,
    12,
    'active',
    now - 6 * HOURS,
    new Date(now - 6 * HOURS).toISOString()
  );

  // Flagged posts for moderation visibility
  insertPost.run(
    'post_003',
    'usr_anonymous_cadet',
    'Discussion',
    'Workshop bench slot complaints',
    'Why are these junior sections even allowed in the engineering lab? Total nuisance.',
    'public',
    'public',
    '',
    JSON.stringify(['#Workshop']),
    0,
    '',
    '',
    '',
    null,
    0,
    'flagged',
    now - 2 * HOURS,
    new Date(now - 2 * HOURS).toISOString()
  );

  insertPost.run(
    'post_004',
    'usr_spammer_99',
    'Discussion',
    'Exam shortcut notice',
    'DM for mid-term OS and DBMS papers 100% genuine guaranteed. Telegram @fastgrades.',
    'public',
    'public',
    '',
    JSON.stringify(['#EndSemPrep']),
    0,
    '',
    '',
    '',
    null,
    0,
    'flagged',
    now - 5 * HOURS,
    new Date(now - 5 * HOURS).toISOString()
  );

  // Personal Space posts (strictly private / group-targeted)
  insertPost.run(
    'post_101',
    'usr_seed_quantum_dev',
    'Discussion',
    '',
    'Finally finished drafting the capstone architecture document. Kept the distributed consensus model lightweight and stateless.',
    'personal',
    'group',
    'Close Friends',
    JSON.stringify([]),
    0,
    '',
    '',
    '',
    null,
    0,
    'active',
    now - 1 * HOURS,
    new Date(now - 1 * HOURS).toISOString()
  );
  insertPost.run(
    'post_102',
    'usr_seed_quantum_dev',
    'Discussion',
    '',
    'Organising a peer study session for Operating Systems virtual memory concepts tomorrow at 4 PM in the common hall.',
    'personal',
    'group',
    'Classmates',
    JSON.stringify([]),
    0,
    '',
    '',
    '',
    null,
    0,
    'active',
    now - 5 * HOURS,
    new Date(now - 5 * HOURS).toISOString()
  );
  insertPost.run(
    'post_103',
    'usr_seed_quantum_dev',
    'Discussion',
    '',
    'Weekend campus cycling group planning a morning ride along the lake perimeter. Keeping group size limited.',
    'personal',
    'group',
    'Close Friends',
    JSON.stringify([]),
    0,
    '',
    '',
    '',
    null,
    0,
    'active',
    now - 2 * DAYS,
    new Date(now - 2 * DAYS).toISOString()
  );

  // Answers / Comments
  const insertAnswer = db.prepare(
    'INSERT INTO post_answers (id, post_id, author_id, content, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertAnswer.run('c1', 'post_1', 'usr_algo_ninja', 'Kahn queue avoids stack overflow on skewed DAGs during timed evals.', now - 18 * 60 * 1000, new Date(now - 18 * 60 * 1000).toISOString());
  insertAnswer.run('a31', 'post_3', 'usr_green_circuit', 'Drop esptool baud rate to 921600 -> 115200 with `--before default_reset --after hard_reset` and swap the micro-USB cable; two lab cables on Bench 4 lack reliable DTR/RTS lines.', now - 1 * HOURS, new Date(now - 1 * HOURS).toISOString());
  insertAnswer.run('a32', 'post_3', 'usr_robo_racer', 'Check CP2102 driver version too — toggling RTS after opening COM port resets the auto-flash circuit cleanly without pressing BOOT.', now - 45 * 60 * 1000, new Date(now - 45 * 60 * 1000).toISOString());

  // Seed some realistic likes & saves so ranking signals have real DB counts
  const insertLike = db.prepare('INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)');
  const likePairs: ReadonlyArray<[string, string]> = [
    ['post_1', 'usr_algo_ninja'],
    ['post_1', 'usr_debug_queen'],
    ['post_1', 'usr_chai_coder'],
    ['post_2', 'usr_code_wizard'],
    ['post_2', 'usr_seed_quantum_dev'],
    ['post_2', 'usr_algo_ninja'],
    ['post_2', 'usr_kernel_kid'],
    ['post_3', 'usr_green_circuit'],
    ['post_3', 'usr_robo_racer'],
    ['post_4', 'usr_drone_pilot'],
    ['post_5', 'usr_seed_quantum_dev'],
    ['post_5', 'usr_algo_ninja'],
    ['post_5', 'usr_debug_queen'],
    ['post_5', 'usr_chai_coder'],
    ['post_5', 'usr_kernel_kid'],
    ['post_6', 'usr_robo_racer'],
    ['post_6', 'usr_ai_architect'],
  ];
  for (const [pid, uid] of likePairs) {
    insertLike.run(pid, uid, new Date(now - 10 * 60 * 1000).toISOString());
  }

  // Threads
  const insertThread = db.prepare('INSERT INTO threads (id, author_id, content, status, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insertThread.run('thread_401', 'usr_compiler_fan', 'Question for 3rd/4th years: When designing a recursive descent parser for the language design elective, is it better to hand-roll the AST nodes or generate them via visitor pattern?', 'active', now - 35 * 60 * 1000, new Date(now - 35 * 60 * 1000).toISOString());
  insertThread.run('thread_402', 'usr_gate_aspirant', 'Starting a weekly peer practice group for Computer Architecture cache-mapping numerical problems. Focus on set-associative miss calculations.', 'active', now - 3 * HOURS, new Date(now - 3 * HOURS).toISOString());

  const insertThreadReply = db.prepare('INSERT INTO thread_replies (id, thread_id, author_id, content, likes_count, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertThreadReply.run('tr_4011', 'thread_401', 'usr_binary_bard', 'Hand-rolling gives you much better custom compiler error spans for diagnostics. The visitor pattern gets verbose very quickly in C++.', 8, now - 20 * 60 * 1000, new Date(now - 20 * 60 * 1000).toISOString());
  insertThreadReply.run('tr_4012', 'thread_401', 'usr_seed_quantum_dev', 'Seconding hand-rolled AST nodes. Professor recommends starting with simple enums for tokens and tagged unions for nodes.', 5, now - 12 * 60 * 1000, new Date(now - 12 * 60 * 1000).toISOString());

  // Pending moderation reports
  const insertReport = db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, content_snippet, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  insertReport.run('rep_001', 'usr_seed_cyber_sage', 'post', 'post_003', 'Hate speech & Code of Conduct violation', 'Post targets junior hostel students with derogatory comments.', 'Why are these junior sections even allowed in the engineering lab?', new Date(now - 2 * HOURS).toISOString());
  insertReport.run('rep_002', 'usr_algo_ninja', 'post', 'post_004', 'Academic Dishonesty / Paid Exam Help', 'Selling leaked question papers for mid-terms on Telegram.', 'DM for mid-term OS and DBMS papers 100% genuine guaranteed.', new Date(now - 5 * HOURS).toISOString());
  insertReport.run('rep_003', 'usr_seed_quantum_dev', 'user', 'usr_spammer_99', 'Commercial Spam Bot', 'Automated account spamming crypto investment links.', 'Earn 5000 daily with campus part-time tasks bit.ly/campus-scam', new Date(now - 12 * HOURS).toISOString());

  // Audit logs
  const insertAudit = db.prepare('INSERT INTO audit_logs (id, timestamp, admin_user, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertAudit.run('log_seed_1', new Date(now - 2 * DAYS).toISOString(), ADMIN_USERNAME, 'SYSTEM_BOOT', 'system', 'auth_service', 'SQLite WAL backend & security guardrails initialized.');
  insertAudit.run('log_seed_2', new Date(now - 1 * DAYS).toISOString(), ADMIN_USERNAME, 'POLICY_UPDATE', 'security', 'rate_limiter', 'Enforced 5 failed login attempt lockout (15-min duration).');

  // Notifications for quantum_dev (never leak private content!)
  const insertNotif = db.prepare('INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, is_read, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)');
  insertNotif.run('n1', 'usr_seed_quantum_dev', 'green_circuit', 'answer', '@green_circuit replied to your Question on ESP32 serial sync', 'post', 'post_3', now - 1 * HOURS, new Date(now - 1 * HOURS).toISOString());
  insertNotif.run('n2', 'usr_seed_quantum_dev', 'code_wizard', 'follow_request', '@code_wizard requested to follow your Personal Space', 'request', 'req_1', now - 2 * HOURS, new Date(now - 2 * HOURS).toISOString());
  return true;
}
