/**
 * Coded by Quentin Leopold · Bachelor's Thesis 2026
 *
 * Single source of truth for the entire survey.
 * Shared by the server (validation + Excel export) and served to the
 * frontend via GET /api/schema so the form renders dynamically.
 *
 * Survey: "The Influence of Loyalty Programs as a Digital Business Model
 *          on Customer Purchase Behavior"
 * Bachelor's Thesis · Quentin Leopold · Spring 2026
 *
 * Covers both online and in-store shopping. 42 questions, sections A–H.
 */

const LIKERT_LABELS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

// Helper to keep Likert items terse.
function likert(id, number, text, opts = {}) {
  return {
    id,
    number,
    type: 'likert',
    text,
    required: true,
    reverse: !!opts.reverse,
    attentionCheck: opts.attentionCheck || null, // expected value if this is a check
  };
}

const SECTIONS = [
  {
    key: 'A',
    title: 'Demographic Information',
    intro: 'A few quick questions about you. None of this identifies you personally.',
    questions: [
      {
        id: 'q1', number: 1, type: 'single', required: true,
        text: 'What is your age group?',
        options: ['18–24', '25–34', '35–44', '45–54', '55–64', '65 or older'],
      },
      {
        id: 'q2', number: 2, type: 'single', required: true,
        text: 'What is your gender?',
        options: ['Male', 'Female', 'Non-binary / third gender', 'Prefer not to say'],
      },
      {
        id: 'q3', number: 3, type: 'single', required: true,
        text: 'What is your highest completed level of education?',
        options: [
          'High school diploma (Abitur)', 'Vocational training', "Bachelor's degree",
          "Master's degree", 'Doctoral degree (PhD)', 'Other',
        ],
      },
      {
        id: 'q4', number: 4, type: 'single', required: true,
        text: 'What is your approximate monthly net income?',
        options: [
          'Below €1,000', '€1,000–€2,000', '€2,001–€3,500',
          '€3,501–€5,000', 'Above €5,000', 'Prefer not to say',
        ],
      },
      {
        id: 'q5', number: 5, type: 'single', required: true,
        text: 'What is your current employment status?',
        options: [
          'Student', 'Employed full-time', 'Employed part-time',
          'Self-employed', 'Unemployed', 'Retired',
        ],
      },
    ],
  },
  {
    key: 'B',
    title: 'Shopping Behavior',
    intro: 'How you shop — both online and in physical stores.',
    questions: [
      {
        id: 'q6', number: 6, type: 'single', required: true,
        text: 'How frequently do you shop for products or services (online or in physical stores)?',
        options: [
          'Daily', 'Several times per week', 'Once a week',
          '2–3 times per month', 'Once a month or less',
        ],
      },
      {
        id: 'q7', number: 7, type: 'single', required: true,
        text: 'What is your approximate average monthly spending on shopping (online and in-store combined)?',
        options: ['Less than €100', '€100–€250', '€251–€500', '€501–€1,000', 'More than €1,000'],
      },
      {
        id: 'q8', number: 8, type: 'single', required: true,
        text: 'When you shop online, which device do you primarily use?',
        options: [
          'Smartphone / mobile app', 'Laptop or desktop PC', 'Tablet',
          'Smart TV / other', 'I do not shop online',
        ],
      },
      {
        id: 'q9', number: 9, type: 'single', required: true,
        text: 'Where do you primarily make your purchases?',
        options: ['Mostly in physical stores', 'Mostly online', 'Both about equally'],
      },
      {
        id: 'q10', number: 10, type: 'multiple', required: true,
        text: 'Which categories do you purchase most frequently?',
        note: 'Multiple answers possible',
        options: [
          'Fashion & Clothing', 'Electronics & Technology', 'Groceries & Food',
          'Travel & Accommodation', 'Beauty & Personal Care', 'Entertainment & Streaming',
          'Sports & Fitness', 'Books & Media',
        ],
      },
    ],
  },
  {
    key: 'C',
    title: 'Loyalty Program Membership',
    intro: 'Your relationship with loyalty programs.',
    questions: [
      {
        id: 'q11', number: 11, type: 'single', required: true,
        text: 'Are you currently a member of any loyalty program (points system, reward card, subscription club, etc.)?',
        options: ['Yes', 'No'],
        // Skip logic: "No" hides Q12–Q16 and jumps to Section D.
        branch: { No: 'skip-rest-of-section' },
      },
      {
        id: 'q12', number: 12, type: 'single', required: true, dependsOn: { q11: 'Yes' },
        text: 'How many loyalty programs are you currently enrolled in?',
        options: ['1', '2–3', '4–5', 'More than 5'],
      },
      {
        id: 'q13', number: 13, type: 'multiple', required: true, dependsOn: { q11: 'Yes' },
        text: 'Which types of loyalty programs are you enrolled in?',
        note: 'Multiple answers possible',
        options: [
          'Points-based', 'Tier-based (Silver / Gold / Platinum)', 'Cash-back or discount',
          'Subscription-based (e.g., Amazon Prime)', 'Digital stamp cards',
          'Coalition programs (e.g., Payback, DeutschlandCard)',
        ],
      },
      {
        id: 'q14', number: 14, type: 'multiple', required: true, dependsOn: { q11: 'Yes' },
        text: 'In which industries do you use loyalty programs?',
        note: 'Multiple answers possible',
        options: [
          'Retail & Fashion (e.g., H&M Club, Zara)', 'Grocery & Supermarket (e.g., Lidl Plus, Rewe, EDEKA)',
          'Airlines & Travel (e.g., Miles & More, Hilton Honors)', "Food Delivery (e.g., Lieferando, Domino's)",
          'E-commerce (e.g., Amazon Prime, Zalando)', 'Financial Services (e.g., credit-card rewards)',
          'Streaming & Entertainment (e.g., Spotify, Netflix)', 'Pharmacy & Health (e.g., dm, Rossmann)',
        ],
      },
      {
        id: 'q15', number: 15, type: 'single', required: true, dependsOn: { q11: 'Yes' },
        text: 'Where do you primarily use your loyalty programs?',
        options: [
          'Mostly in physical stores (e.g., scanning an app at checkout)',
          'Mostly online', 'Both about equally',
        ],
      },
      {
        id: 'q16', number: 16, type: 'single', required: true, dependsOn: { q11: 'Yes' },
        text: 'How often do you actively use your loyalty benefits (redeeming points, using discounts)?',
        options: [
          'Every relevant purchase', 'Frequently (>half the time)', 'Sometimes (~half)',
          'Rarely (<half)', 'Almost never',
        ],
      },
    ],
  },
  {
    key: 'D',
    title: 'Impact on Purchase Behavior',
    intro: 'Rate your agreement. 1 = Strongly Disagree … 5 = Strongly Agree.',
    likert: true,
    questions: [
      likert('q17', 17, 'Loyalty programs influence my decision to purchase from a specific brand.'),
      likert('q18', 18, 'I buy more frequently from brands where I hold a loyalty membership.'),
      likert('q19', 19, 'I increase my spending to reach the next reward tier or point threshold.'),
      likert('q20', 20, 'I prefer brands offering loyalty programs over competitors that do not.'),
      likert('q21', 21, 'Loyalty programs have little real effect on how much or how often I buy.', { reverse: true }),
      likert('q22', 22, 'Earning and redeeming rewards motivates me to make repeat purchases.'),
      likert('q23', 23, 'I deliberately delay purchases to coincide with loyalty promotions.'),
      likert('q24', 24, 'Loyalty programs make me less likely to switch to a competing brand.'),
    ],
  },
  {
    key: 'E',
    title: 'Digital Loyalty Programs & Technology Acceptance',
    intro: 'Rate your agreement. 1 = Strongly Disagree … 5 = Strongly Agree.',
    likert: true,
    questions: [
      likert('q25', 25, 'I prefer digital loyalty programs (app/website) over physical loyalty cards.'),
      likert('q26', 26, 'I regularly use a dedicated loyalty app on my smartphone.'),
      likert('q27', 27, 'Personalized offers based on my purchase history increase my likelihood to buy.'),
      likert('q28', 28, 'Gamification elements (badges, challenges, leaderboards) motivate me to engage more.'),
      likert('q29', 29, 'The user-friendliness of a loyalty app is important to my decision to join it.'),
      likert('q30', 30, 'I find most loyalty apps more trouble than they are worth.', { reverse: true }),
    ],
  },
  {
    key: 'F',
    title: 'Data Privacy & Trust',
    intro: 'Rate your agreement. 1 = Strongly Disagree … 5 = Strongly Agree.',
    likert: true,
    questions: [
      likert('q31', 31, 'I trust that my personal data is handled securely within loyalty-program databases.'),
      likert('q32', 32, 'I am comfortable with brands using my purchase data to send me personalized offers.'),
      likert('q33', 33, 'I am worried about how loyalty programs collect and use my personal data.', { reverse: true }),
      likert('q34', 34, 'Concerns about data privacy reduce my willingness to join or use loyalty programs.', { reverse: true }),
      likert('q35', 35, 'I read or skim the privacy policy before joining a loyalty program.'),
    ],
  },
  {
    key: 'G',
    title: 'Overall Satisfaction & Loyalty',
    intro: 'Rate your agreement. 1 = Strongly Disagree … 5 = Strongly Agree.',
    likert: true,
    questions: [
      likert('q36', 36, 'Overall, I am satisfied with the loyalty programs I am enrolled in.'),
      likert('q37', 37, 'Loyalty programs make me feel valued and recognized as a customer.'),
      likert('q38', 38, 'Without loyalty programs, I would switch to competing brands more frequently.'),
      likert('q39', 39, 'Overall, loyalty programs add little to my shopping experience.', { reverse: true }),
      likert('q40', 40, 'To confirm you are reading carefully, please select "Disagree" for this item.', { attentionCheck: 2 }),
    ],
  },
  {
    key: 'H',
    title: 'Open-Ended Questions',
    intro: 'Optional — but your words help the most. Skip any you prefer not to answer.',
    questions: [
      {
        id: 'q41', number: 41, type: 'text', required: false,
        text: 'In your own words: what is the biggest benefit you have personally experienced from a loyalty program?',
        placeholder: 'Type your answer here…',
      },
      {
        id: 'q42', number: 42, type: 'text', required: false,
        text: 'What improvements or new features would you like to see in digital loyalty programs in the future?',
        placeholder: 'Type your answer here…',
      },
    ],
  },
];

const META = {
  title: 'The Influence of Loyalty Programs on Customer Purchase Behavior',
  subtitle: 'A Digital Business Model Perspective',
  author: 'Quentin Leopold',
  context: "Bachelor's Thesis Survey · Spring 2026",
  estimatedMinutes: '8–10',
  likertLabels: LIKERT_LABELS,
};

// Flat lookup of every question by id — used heavily by the server.
const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);
const QUESTION_BY_ID = Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, q]));

module.exports = { SECTIONS, META, ALL_QUESTIONS, QUESTION_BY_ID, LIKERT_LABELS };
