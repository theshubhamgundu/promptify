/**
 * Round 3: Vision Challenge - Question Bank
 * 
 * 30 vision analysis questions across 3 tiers:
 * - Tier 1 (Easy): 10 questions × 10 points = 100 pts
 * - Tier 2 (Medium): 10 questions × 15 points = 150 pts
 * - Tier 3 (Hard): 10 questions × 20 points = 200 pts
 * 
 * Total: 450 points maximum
 * Time Limit: 40 minutes
 * 
 * Evaluation: Weighted pattern matching (sum of matched pattern weights)
 */

export type DifficultyTier = 'TIER1' | 'TIER2' | 'TIER3';

export interface EvaluationPattern {
  pattern: RegExp;
  label: string;
  weight: number;
}


export interface VisionQuestion {
  id: string;
  tier: DifficultyTier;
  questionNumber: number; // 1-10 within each tier
  title: string;
  imageUrl: string;
  description: string;
  evaluationPatterns: EvaluationPattern[];
  maxScore: number; // 10, 15, or 20 based on tier
}

// =============================================================================
// TIER 1: EASY (10 points each)
// =============================================================================

const TIER1_QUESTIONS: VisionQuestion[] = [
  {
    id: 'T1-Q1',
    tier: 'TIER1',
    questionNumber: 1,
    title: 'Rose on Table',
    imageUrl: '/assets/round 3 images/tier1-q1-rose.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /rose|flower/i, label: 'subject', weight: 2 },
      { pattern: /red/i, label: 'color', weight: 1.5 },
      { pattern: /glass|vase/i, label: 'container', weight: 1.5 },
      { pattern: /wood(en)?\s*table/i, label: 'surface', weight: 1.5 },
      { pattern: /natural|window|soft light/i, label: 'lighting', weight: 1.5 },
      { pattern: /blur|shallow|bokeh|depth of field/i, label: 'focus effect', weight: 2 }
    ]
  },
  
  {
    id: 'T1-Q2',
    tier: 'TIER1',
    questionNumber: 2,
    title: 'Food',
    imageUrl: '/assets/round 3 images/tier1-q2-food.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /pancake/i, label: 'subject', weight: 2 },
      { pattern: /stack(ed)?/i, label: 'arrangement', weight: 1.5 },
      { pattern: /syrup|maple/i, label: 'topping', weight: 2 },
      { pattern: /butter/i, label: 'detail', weight: 1.5 },
      { pattern: /white|ceramic|plate/i, label: 'plate', weight: 1.5 },
      { pattern: /top.?down|overhead|birds?.?eye/i, label: 'camera angle', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q3',
    tier: 'TIER1',
    questionNumber: 3,
    title: 'Architecture',
    imageUrl: '/assets/round 3 images/tier1-q3-architecture.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /brick|cottage|house/i, label: 'building', weight: 2 },
      { pattern: /triangular|pitched|sloped roof/i, label: 'roof', weight: 1.5 },
      { pattern: /door/i, label: 'door', weight: 1 },
      { pattern: /window/i, label: 'windows', weight: 1.5 },
      { pattern: /grass|green|lawn/i, label: 'surroundings', weight: 1.5 },
      { pattern: /clear sky|sunny|daytime/i, label: 'sky/time', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q4',
    tier: 'TIER1',
    questionNumber: 4,
    title: 'Animals',
    imageUrl: '/assets/round 3 images/tier1-q4-animals.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /cat|kitten|tabby/i, label: 'animal', weight: 2 },
      { pattern: /orange|ginger/i, label: 'color', weight: 1.5 },
      { pattern: /windowsill|window ledge/i, label: 'location', weight: 2 },
      { pattern: /looking out|gazing|outside/i, label: 'gaze', weight: 1.5 },
      { pattern: /soft|afternoon|warm light/i, label: 'lighting', weight: 1.5 },
      { pattern: /blur|bokeh|background/i, label: 'background', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q5',
    tier: 'TIER1',
    questionNumber: 5,
    title: 'Vehicles',
    imageUrl: '/assets/round 3 images/tier1-q5-vehicles.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /bicycle|bike/i, label: 'vehicle', weight: 2 },
      { pattern: /yellow/i, label: 'color', weight: 1.5 },
      { pattern: /vintage|old.?fashioned|retro/i, label: 'style', weight: 1.5 },
      { pattern: /leaning|resting against/i, label: 'pose', weight: 1.5 },
      { pattern: /wicker|basket/i, label: 'accessory', weight: 1.5 },
      { pattern: /cobblestone|brick street/i, label: 'ground', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q6',
    tier: 'TIER1',
    questionNumber: 6,
    title: 'Weather',
    imageUrl: '/assets/round 3 images/tier1-q6-weather.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /umbrella/i, label: 'object', weight: 2 },
      { pattern: /black/i, label: 'color', weight: 1 },
      { pattern: /open|unfolded/i, label: 'state', weight: 1.5 },
      { pattern: /wet|rain(y)?|drizzle/i, label: 'weather', weight: 2 },
      { pattern: /puddle|reflection/i, label: 'detail', weight: 2 },
      { pattern: /overcast|grey|cloudy/i, label: 'lighting', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q7',
    tier: 'TIER1',
    questionNumber: 7,
    title: 'Interiors',
    imageUrl: '/assets/round 3 images/tier1-q7-interiors.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /armchair|chair/i, label: 'furniture', weight: 2 },
      { pattern: /beige|tan|cream/i, label: 'color', weight: 1 },
      { pattern: /table/i, label: 'table', weight: 1.5 },
      { pattern: /books?/i, label: 'books', weight: 1.5 },
      { pattern: /tea|cup|mug/i, label: 'drink', weight: 1.5 },
      { pattern: /lamp|warm light|cozy/i, label: 'lighting/mood', weight: 2.5 }
    ]
  },
  
  {
    id: 'T1-Q8',
    tier: 'TIER1',
    questionNumber: 8,
    title: 'Sports',
    imageUrl: '/assets/round 3 images/tier1-q8-sports.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /basketball/i, label: 'object', weight: 2 },
      { pattern: /hoop|net|basket/i, label: 'target', weight: 2 },
      { pattern: /mid.?air|flying|in motion/i, label: 'position', weight: 1.5 },
      { pattern: /outdoor|court/i, label: 'setting', weight: 1.5 },
      { pattern: /sunset|golden hour/i, label: 'lighting', weight: 1.5 },
      { pattern: /blur|motion/i, label: 'motion effect', weight: 1.5 }
    ]
  },
  
  {
    id: 'T1-Q9',
    tier: 'TIER1',
    questionNumber: 9,
    title: 'Objects/Fashion',
    imageUrl: '/assets/round 3 images/tier1-q9-objects.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /boots?|shoes?/i, label: 'object', weight: 2 },
      { pattern: /brown|tan/i, label: 'color', weight: 1 },
      { pattern: /leather/i, label: 'material', weight: 1.5 },
      { pattern: /pair|neatly|side by side/i, label: 'arrangement', weight: 1.5 },
      { pattern: /wood(en)?\s*floor|rustic/i, label: 'floor', weight: 1.5 },
      { pattern: /morning|side light|sunlight/i, label: 'lighting', weight: 2.5 }
    ]
  },
  
  {
    id: 'T1-Q10',
    tier: 'TIER1',
    questionNumber: 10,
    title: 'Space/Sky',
    imageUrl: '/assets/round 3 images/tier1-q10-sky.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 10,
    evaluationPatterns: [
      { pattern: /moon/i, label: 'subject', weight: 2 },
      { pattern: /full moon/i, label: 'moon phase', weight: 1.5 },
      { pattern: /night|dark sky/i, label: 'time', weight: 1.5 },
      { pattern: /stars?/i, label: 'stars', weight: 1.5 },
      { pattern: /pine|trees?|silhouette/i, label: 'foreground', weight: 2 },
      { pattern: /clear sky/i, label: 'sky condition', weight: 1.5 }
    ]
  }
];

// =============================================================================
// TIER 2: MEDIUM (15 points each)
// =============================================================================

const TIER2_QUESTIONS: VisionQuestion[] = [
  {
    id: 'T2-Q1',
    tier: 'TIER2',
    questionNumber: 1,
    title: 'Urban Street',
    imageUrl: '/assets/round 3 images/tier2-q1-urban.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /crosswalk|street|intersection/i, label: 'setting', weight: 2.5 },
      { pattern: /4|four.*(people|pedestrian)/i, label: 'count', weight: 2.5 },
      { pattern: /red umbrella/i, label: 'specific detail', weight: 3 },
      { pattern: /taxi|yellow cab/i, label: 'vehicle', weight: 2.5 },
      { pattern: /glass building|skyscraper/i, label: 'background', weight: 2 },
      { pattern: /overcast|cloudy|grey sky/i, label: 'weather', weight: 2 }
    ]
  },
  
  {
    id: 'T2-Q2',
    tier: 'TIER2',
    questionNumber: 2,
    title: 'Market Scene',
    imageUrl: '/assets/round 3 images/tier2-q2-market.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /market|stall/i, label: 'setting', weight: 2 },
      { pattern: /orange|apple/i, label: 'produce', weight: 2 },
      { pattern: /crate/i, label: 'container', weight: 2 },
      { pattern: /vendor|seller/i, label: 'person', weight: 1.5 },
      { pattern: /green apron/i, label: 'clothing detail', weight: 2.5 },
      { pattern: /string lights?/i, label: 'lighting detail', weight: 2.5 },
      { pattern: /evening|dusk/i, label: 'time', weight: 2.5 }
    ]
  },
  
  {
    id: 'T2-Q3',
    tier: 'TIER2',
    questionNumber: 3,
    title: 'Wildlife',
    imageUrl: '/assets/round 3 images/tier2-q3-wildlife.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /deer/i, label: 'animal', weight: 2.5 },
      { pattern: /two|2/i, label: 'count', weight: 2 },
      { pattern: /grazing|eating/i, label: 'action', weight: 1.5 },
      { pattern: /misty|fog/i, label: 'atmosphere', weight: 2.5 },
      { pattern: /pine|forest/i, label: 'setting', weight: 2 },
      { pattern: /golden|morning light/i, label: 'lighting', weight: 2.5 }
    ]
  },
  
  {
    id: 'T2-Q4',
    tier: 'TIER2',
    questionNumber: 4,
    title: 'Workspace',
    imageUrl: '/assets/round 3 images/tier2-q4-workspace.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /desk/i, label: 'furniture', weight: 2 },
      { pattern: /laptop/i, label: 'device', weight: 2 },
      { pattern: /spreadsheet|excel|screen/i, label: 'screen detail', weight: 2 },
      { pattern: /succulent|plant/i, label: 'left object', weight: 2 },
      { pattern: /coffee/i, label: 'right object', weight: 2 },
      { pattern: /window|city view/i, label: 'background', weight: 2.5 },
      { pattern: /minimalist/i, label: 'style', weight: 1.5 }
    ]
  },
  
  {
    id: 'T2-Q5',
    tier: 'TIER2',
    questionNumber: 5,
    title: 'Sports/Group',
    imageUrl: '/assets/round 3 images/tier2-q5-cycling.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /5|five.*cyclist/i, label: 'count', weight: 2.5 },
      { pattern: /single.?file|line/i, label: 'formation', weight: 2 },
      { pattern: /coastal|ocean|sea/i, label: 'setting', weight: 2.5 },
      { pattern: /right side/i, label: 'position detail', weight: 1.5 },
      { pattern: /cloudy|overcast/i, label: 'sky', weight: 1.5 },
      { pattern: /orange jersey/i, label: 'distinguishing detail', weight: 3 }
    ]
  },
  
  {
    id: 'T2-Q6',
    tier: 'TIER2',
    questionNumber: 6,
    title: 'Table Setting',
    imageUrl: '/assets/round 3 images/tier2-q6-table.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /table for two|two people/i, label: 'setting', weight: 2 },
      { pattern: /candle/i, label: 'centerpiece', weight: 2 },
      { pattern: /wine glass/i, label: 'glassware', weight: 2 },
      { pattern: /pasta/i, label: 'dish 1', weight: 2 },
      { pattern: /salad/i, label: 'dish 2', weight: 2 },
      { pattern: /left/i, label: 'position 1', weight: 1.5 },
      { pattern: /right/i, label: 'position 2', weight: 1.5 },
      { pattern: /dim|warm/i, label: 'lighting', weight: 2 }
    ]
  },
  
  {
    id: 'T2-Q7',
    tier: 'TIER2',
    questionNumber: 7,
    title: 'Street/Architecture',
    imageUrl: '/assets/round 3 images/tier2-q7-alley.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /alley|alleyway|narrow street/i, label: 'setting', weight: 2 },
      { pattern: /blue.*(left|building)/i, label: 'left building color', weight: 2 },
      { pattern: /yellow.*(right|building)/i, label: 'right building color', weight: 2 },
      { pattern: /laundry|clothes.*line/i, label: 'detail', weight: 2 },
      { pattern: /cat/i, label: 'animal', weight: 1.5 },
      { pattern: /cobblestone/i, label: 'ground', weight: 1.5 },
      { pattern: /shadow|midday|harsh sun/i, label: 'lighting', weight: 2 }
    ]
  },
  
  {
    id: 'T2-Q8',
    tier: 'TIER2',
    questionNumber: 8,
    title: 'Product/Technology',
    imageUrl: '/assets/round 3 images/tier2-q8-phone.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /smartphone|phone/i, label: 'main object', weight: 2.5 },
      { pattern: /marble/i, label: 'surface', weight: 2 },
      { pattern: /earbuds|airpods/i, label: 'secondary object', weight: 2.5 },
      { pattern: /open case/i, label: 'state detail', weight: 1.5 },
      { pattern: /plant/i, label: 'background element', weight: 2 },
      { pattern: /out of focus|blur/i, label: 'focus detail', weight: 1.5 },
      { pattern: /studio light|from above/i, label: 'lighting', weight: 2 }
    ]
  },
  
  {
    id: 'T2-Q9',
    tier: 'TIER2',
    questionNumber: 9,
    title: 'Weather/Landscape',
    imageUrl: '/assets/round 3 images/tier2-q9-lighthouse.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /lighthouse/i, label: 'structure', weight: 2.5 },
      { pattern: /cliff|rocky/i, label: 'setting', weight: 2 },
      { pattern: /waves?|crashing/i, label: 'weather action', weight: 2.5 },
      { pattern: /storm(y)?|dark clouds?/i, label: 'sky', weight: 2 },
      { pattern: /beam|light.*(shining|visible)/i, label: 'specific detail', weight: 3 }
    ]
  },
  
  {
    id: 'T2-Q10',
    tier: 'TIER2',
    questionNumber: 10,
    title: 'Portrait/Group',
    imageUrl: '/assets/round 3 images/tier2-q10-friends.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 15,
    evaluationPatterns: [
      { pattern: /three|3.*(friends|people)/i, label: 'count', weight: 2.5 },
      { pattern: /bench|park/i, label: 'setting', weight: 2 },
      { pattern: /laughing|smiling|happy/i, label: 'emotion', weight: 2 },
      { pattern: /middle.*point|pointing/i, label: 'action detail', weight: 2.5 },
      { pattern: /autumn|fall leaves/i, label: 'ground detail', weight: 2 },
      { pattern: /warm|late.?afternoon|golden/i, label: 'lighting', weight: 2 }
    ]
  }
];

// =============================================================================
// TIER 3: HARD (20 points each)
// =============================================================================

const TIER3_QUESTIONS: VisionQuestion[] = [
  {
    id: 'T3-Q1',
    tier: 'TIER3',
    questionNumber: 1,
    title: 'Complex Urban',
    imageUrl: '/assets/round 3 images/tier3-q1-night-city.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /wide.?angle/i, label: 'camera angle', weight: 2 },
      { pattern: /rain(y)?.*night|night.*rain/i, label: 'time/weather', weight: 2.5 },
      { pattern: /neon/i, label: 'lighting detail', weight: 2.5 },
      { pattern: /red.*blue|blue.*red/i, label: 'color detail', weight: 2 },
      { pattern: /walking away|back turned/i, label: 'subject action', weight: 2.5 },
      { pattern: /parked cars?/i, label: 'vehicles', weight: 2 },
      { pattern: /storefront|mannequin/i, label: 'specific detail', weight: 2.5 },
      { pattern: /right side/i, label: 'position', weight: 1 }
    ]
  },
  
  {
    id: 'T3-Q2',
    tier: 'TIER3',
    questionNumber: 2,
    title: 'Macro Photography',
    imageUrl: '/assets/round 3 images/tier3-q2-macro.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /macro/i, label: 'shot type', weight: 3 },
      { pattern: /water droplet|dew drop/i, label: 'subject', weight: 2.5 },
      { pattern: /leaf/i, label: 'surface', weight: 2 },
      { pattern: /reflection.*flower|flower.*reflection/i, label: 'specific detail', weight: 3.5 },
      { pattern: /dew/i, label: 'surrounding detail', weight: 2 },
      { pattern: /upper left|top left/i, label: 'lighting direction', weight: 2 }
    ]
  },
  
  {
    id: 'T3-Q3',
    tier: 'TIER3',
    questionNumber: 3,
    title: 'Fantasy/Stylized',
    imageUrl: '/assets/round 3 images/tier3-q3-fantasy.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /digital (art|painting)|illustration/i, label: 'medium', weight: 2 },
      { pattern: /floating island/i, label: 'main structure', weight: 3 },
      { pattern: /tree/i, label: 'central object', weight: 2 },
      { pattern: /waterfall/i, label: 'detail', weight: 2.5 },
      { pattern: /bridge/i, label: 'secondary structure', weight: 2 },
      { pattern: /purple.*orange|orange.*purple|sunset/i, label: 'color palette', weight: 2.5 }
    ]
  },
  
  {
    id: 'T3-Q4',
    tier: 'TIER3',
    questionNumber: 4,
    title: 'Complex Food',
    imageUrl: '/assets/round 3 images/tier3-q4-charcuterie.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /charcuterie/i, label: 'subject', weight: 2.5 },
      { pattern: /3|three.*cheese/i, label: 'cheese count', weight: 2.5 },
      { pattern: /fan.*shape|fanned/i, label: 'meat arrangement', weight: 2.5 },
      { pattern: /honey/i, label: 'accompaniment', weight: 2 },
      { pattern: /fig/i, label: 'fruit', weight: 2 },
      { pattern: /walnut/i, label: 'additional detail', weight: 2 },
      { pattern: /slate|dark board/i, label: 'board material', weight: 2 }
    ]
  },
  
  {
    id: 'T3-Q5',
    tier: 'TIER3',
    questionNumber: 5,
    title: 'Complex Architecture',
    imageUrl: '/assets/round 3 images/tier3-q5-library.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /two.?story|double.?height/i, label: 'structure', weight: 2.5 },
      { pattern: /spiral staircase/i, label: 'connecting element', weight: 3 },
      { pattern: /reader|person.*reading|sitting/i, label: 'subject', weight: 2 },
      { pattern: /arched window/i, label: 'light source', weight: 2.5 },
      { pattern: /dust particles?/i, label: 'atmospheric detail', weight: 3 }
    ]
  },
  
  {
    id: 'T3-Q6',
    tier: 'TIER3',
    questionNumber: 6,
    title: 'Wildlife/Action',
    imageUrl: '/assets/round 3 images/tier3-q6-eagle.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /eagle|hawk|bird of prey/i, label: 'animal', weight: 2.5 },
      { pattern: /diving|swooping/i, label: 'action', weight: 2.5 },
      { pattern: /wings?.*folded/i, label: 'wing position', weight: 2.5 },
      { pattern: /talons?/i, label: 'body detail', weight: 2 },
      { pattern: /fish/i, label: 'target', weight: 2.5 },
      { pattern: /spray|water droplets?/i, label: 'motion effect', weight: 2 }
    ]
  },
  
  {
    id: 'T3-Q7',
    tier: 'TIER3',
    questionNumber: 7,
    title: 'Futuristic/Tech',
    imageUrl: '/assets/round 3 images/tier3-q7-robot.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /robotic arm|robot arm/i, label: 'subject', weight: 3 },
      { pattern: /circuit board/i, label: 'action detail', weight: 2.5 },
      { pattern: /industrial|lab/i, label: 'setting', weight: 2 },
      { pattern: /blue.*led|led.*blue/i, label: 'lighting detail', weight: 2.5 },
      { pattern: /spark|solder/i, label: 'secondary action', weight: 2.5 },
      { pattern: /monitor|screen|code/i, label: 'background', weight: 2 }
    ]
  },
  
  {
    id: 'T3-Q8',
    tier: 'TIER3',
    questionNumber: 8,
    title: 'Dramatic Landscape',
    imageUrl: '/assets/round 3 images/tier3-q8-lightning.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /lone tree|single tree/i, label: 'subject', weight: 2.5 },
      { pattern: /hill/i, label: 'position', weight: 2 },
      { pattern: /lightning/i, label: 'weather event', weight: 3 },
      { pattern: /distance|behind/i, label: 'position detail', weight: 1.5 },
      { pattern: /purple.?grey|dark clouds?/i, label: 'sky color', weight: 2 },
      { pattern: /grass.*bend|wind/i, label: 'foreground detail', weight: 2.5 }
    ]
  },
  
  {
    id: 'T3-Q9',
    tier: 'TIER3',
    questionNumber: 9,
    title: 'Cultural/Event Scene',
    imageUrl: '/assets/round 3 images/tier3-q9-lanterns.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /lantern festival|diwali|loi krathong|yi peng|festival of lights/i, label: 'event type', weight: 3 },
      { pattern: /red.*gold|gold.*red/i, label: 'lantern colors', weight: 2 },
      { pattern: /floating|rising|releasing/i, label: 'direction/action', weight: 2.5 },
      { pattern: /starry|night sky/i, label: 'sky detail', weight: 2 },
      { pattern: /crowd|people.*looking up/i, label: 'crowd action', weight: 2.5 },
      { pattern: /temple|silhouette/i, label: 'background structure', weight: 2 }
    ]
  },
  
  {
    id: 'T3-Q10',
    tier: 'TIER3',
    questionNumber: 10,
    title: 'Complex Portrait/Narrative',
    imageUrl: '/assets/round 3 images/tier3-q10-craftsman.jpg',
    description: 'Analyze this image in detail.',
    maxScore: 20,
    evaluationPatterns: [
      { pattern: /elderly|old man|craftsman/i, label: 'subject', weight: 2.5 },
      { pattern: /pottery wheel/i, label: 'action/tool', weight: 3 },
      { pattern: /clay/i, label: 'detail', weight: 2 },
      { pattern: /side window|dust particles?/i, label: 'lighting', weight: 2.5 },
      { pattern: /shelves?.*pottery|pottery.*shelves?/i, label: 'background', weight: 2 },
      { pattern: /cat.*sleeping|sleeping cat/i, label: 'secondary detail', weight: 2 }
    ]
  }
];

// =============================================================================
// EXPORT ALL QUESTIONS
// =============================================================================

export const ALL_ROUND3_QUESTIONS: VisionQuestion[] = [
  ...TIER1_QUESTIONS,
  ...TIER2_QUESTIONS,
  ...TIER3_QUESTIONS
];

// Helper to get question by ID
export function getRound3Question(questionId: string): VisionQuestion | null {
  return ALL_ROUND3_QUESTIONS.find(q => q.id === questionId) || null;
}

// Helper to get questions by tier
export function getRound3QuestionsByTier(tier: DifficultyTier): VisionQuestion[] {
  return ALL_ROUND3_QUESTIONS.filter(q => q.tier === tier);
}


