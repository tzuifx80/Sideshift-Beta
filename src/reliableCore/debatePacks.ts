import { takes, type Language } from '../domain'
import { TACTIC_IDS } from './tactics'

export type DebatePack = {
  takeId: string
  motionKeywords: string[]
  topicKeywords: string[]
  commonProClaims: string[]
  commonContraClaims: string[]
  assumptions: string[]
  tradeOffs: string[]
  counterexampleCategories: string[]
  relevantQuestions: string[]
  closingChallenges: string[]
  evaluationGuidance?: string[]
}

type CuratedPackContent = Omit<DebatePack, 'takeId' | 'motionKeywords'>

const GENERIC_PACK: CuratedPackContent = {
  topicKeywords: ['trade-off', 'evidence', 'scope', 'values', 'implementation'],
  commonProClaims: ['benefit', 'principle', 'practical need'],
  commonContraClaims: ['risk', 'cost', 'unintended effect'],
  assumptions: ['context matters', 'not every case is identical'],
  tradeOffs: ['benefit versus cost', 'speed versus caution'],
  counterexampleCategories: ['edge cases', 'different contexts', 'competing values'],
  relevantQuestions: ['What evidence would change your mind?', 'Which trade-off matters most here?'],
  closingChallenges: ['What is the hinge your case rests on?'],
  evaluationGuidance: ['reward relevance and structure', 'do not reward length alone'],
}

export const CURATED_PACKS: Record<string, CuratedPackContent> = {
  'society-media-age': {
    topicKeywords: ['teenagers', 'safety', 'autonomy', 'parental role', 'platform design', 'enforcement'],
    commonProClaims: ['younger users face higher harm risk', 'guardrails can reduce exposure', 'parents need clearer defaults'],
    commonContraClaims: ['bans push activity underground', 'maturity varies by person', 'education may work better than restriction'],
    assumptions: ['harm and benefit can coexist', 'policy must be enforceable in practice'],
    tradeOffs: ['protection versus independence', 'platform rules versus family choice'],
    counterexampleCategories: ['support communities online', 'creative outlets for teens', 'uneven parental supervision'],
    relevantQuestions: ['Which harms are most common and preventable?', 'Who should set the default rules?'],
    closingChallenges: ['Name the age threshold you defend and what changes at that line.'],
    evaluationGuidance: ['reward specificity about harms and remedies', 'penalise vague moral panic'],
  },
  'politics-voting-age': {
    topicKeywords: ['democracy', 'civic participation', 'maturity', 'representation', 'taxation', 'education'],
    commonProClaims: ['young people are affected by policy', 'civic education can prepare voters', 'lowering age increases legitimacy'],
    commonContraClaims: ['judgment develops unevenly', 'political knowledge gaps remain', 'symbolic change without preparation'],
    assumptions: ['voting is both right and responsibility', 'institutions can adapt gradually'],
    tradeOffs: ['inclusion versus readiness', 'local versus national elections'],
    counterexampleCategories: ['countries with lower voting ages', 'youth councils without full votes'],
    relevantQuestions: ['Should voting rights match other adult responsibilities?', 'What preparation would make change credible?'],
    closingChallenges: ['Defend a specific age and one reform that would accompany it.'],
    evaluationGuidance: ['reward institutional detail', 'avoid treating age as self-evident'],
  },
  'football-var': {
    topicKeywords: ['fairness', 'flow of play', 'referee authority', 'technology', 'fan experience', 'marginal calls'],
    commonProClaims: ['reduces clearly wrong decisions', 'adds transparency on key moments', 'protects competitive integrity'],
    commonContraClaims: ['breaks emotional rhythm', 'creates new controversies', 'human judgment still interprets footage'],
    assumptions: ['some errors are costlier than others', 'sport balances spectacle and justice'],
    tradeOffs: ['accuracy versus spontaneity', 'full review versus selective checks'],
    counterexampleCategories: ['sports with limited replay', 'long stoppages changing momentum'],
    relevantQuestions: ['Which decisions must be correct versus acceptably human?', 'How should fans experience delays?'],
    closingChallenges: ['Pick one VAR rule you would keep or remove and why.'],
    evaluationGuidance: ['reward trade-off clarity', 'penalise nostalgia without analysis'],
  },
  'ai-jobs': {
    topicKeywords: ['automation', 'productivity', 'retraining', 'inequality', 'creative work', 'regulation'],
    commonProClaims: ['tools can augment skilled workers', 'new tasks emerge with technology', 'efficiency frees time for higher-value work'],
    commonContraClaims: ['displacement can be rapid and uneven', 'retraining is costly and slow', 'power concentrates among owners of systems'],
    assumptions: ['labour markets adapt imperfectly', 'policy shapes who gains'],
    tradeOffs: ['speed of adoption versus worker protection', 'innovation versus stability'],
    counterexampleCategories: ['sectors with slow AI uptake', 'jobs requiring trust and presence'],
    relevantQuestions: ['Which tasks are truly automatable soon?', 'Who should fund transition support?'],
    closingChallenges: ['Name one job category and how policy should respond.'],
    evaluationGuidance: ['reward nuance about timelines', 'avoid deterministic hype or doom'],
  },
  'climate-action': {
    topicKeywords: ['emissions', 'energy transition', 'cost of living', 'global coordination', 'adaptation', 'justice'],
    commonProClaims: ['delay increases future harm', 'clean investment can spur innovation', 'collective action reduces free-riding'],
    commonContraClaims: ['transition costs hit some regions harder', 'global agreements are hard to enforce', 'technology alone may not suffice'],
    assumptions: ['risks are unevenly distributed', 'short-term and long-term interests conflict'],
    tradeOffs: ['speed of decarbonisation versus affordability', 'national action versus international treaties'],
    counterexampleCategories: ['regions dependent on fossil revenue', 'successful local pilots'],
    relevantQuestions: ['What is the fairest way to share costs?', 'Which policies work without perfect global unity?'],
    closingChallenges: ['Identify one measurable target and a realistic first step.'],
    evaluationGuidance: ['reward feasible pathways', 'penalise slogans without mechanism'],
  },
  'gaming-microtransactions': {
    topicKeywords: ['consumer choice', 'game design', 'youth spending', 'fairness', 'revenue models', 'regulation'],
    commonProClaims: ['players fund ongoing development', 'optional purchases preserve access', 'markets let users vote with wallets'],
    commonContraClaims: ['dark patterns exploit impulse', 'pay-to-win undermines skill', 'children may lack spending judgment'],
    assumptions: ['not all monetisation models are equal', 'disclosure changes behaviour somewhat'],
    tradeOffs: ['developer revenue versus player trust', 'freedom to spend versus protective rules'],
    counterexampleCategories: ['cosmetic-only models', 'games ruined by aggressive monetisation'],
    relevantQuestions: ['When does optional become coercive?', 'Should minors face stricter defaults?'],
    closingChallenges: ['Defend one practice you would ban or allow and why.'],
    evaluationGuidance: ['reward design literacy', 'avoid treating all microtransactions as identical'],
  },
  'education-homework': {
    topicKeywords: ['practice', 'family time', 'equity', 'classroom time', 'stress', 'independent learning'],
    commonProClaims: ['reinforces classroom concepts', 'builds discipline and study habits', 'parents can see progress'],
    commonContraClaims: ['widens gaps when home support varies', 'quality beats quantity', 'evening time needs rest and activities'],
    assumptions: ['homework quality varies widely', 'age and subject change the calculus'],
    tradeOffs: ['academic rigour versus wellbeing', 'uniform policy versus teacher discretion'],
    counterexampleCategories: ['flipped classrooms', 'schools that eliminated homework'],
    relevantQuestions: ['What homework actually improves learning?', 'How should inequitable home environments matter?'],
    closingChallenges: ['Propose a homework rule for one age group.'],
    evaluationGuidance: ['reward educational reasoning', 'penalise blanket nostalgia'],
  },
  'health-mental-health': {
    topicKeywords: ['stigma', 'access to care', 'workplace culture', 'prevention', 'privacy', 'funding'],
    commonProClaims: ['open conversation reduces isolation', 'early support prevents crisis', 'productivity and dignity align'],
    commonContraClaims: ['awareness without services frustrates', 'privacy concerns in small communities', 'one-size campaigns miss nuance'],
    assumptions: ['mental health needs are diverse', 'systems are under-resourced in many places'],
    tradeOffs: ['visibility versus confidentiality', 'individual coping versus structural change'],
    counterexampleCategories: ['effective peer support models', 'token awareness days without follow-up'],
    relevantQuestions: ['What would meaningful support look like locally?', 'How do we talk openly without oversimplifying?'],
    closingChallenges: ['Name one personal and one systemic action worth prioritising.'],
    evaluationGuidance: ['reward compassionate precision', 'avoid clinical claims without humility'],
  },
  'entertainment-streaming': {
    topicKeywords: ['choice', 'creator pay', 'bundling', 'discovery', 'subscription fatigue', 'cultural access'],
    commonProClaims: ['users pay only for what they watch', 'global catalogues increase diversity', 'competition drives better interfaces'],
    commonContraClaims: ['fragmentation raises total cost', 'creators earn uneven shares', 'recommendation loops narrow taste'],
    assumptions: ['convenience and cost trade off', 'licensing shapes what is available'],
    tradeOffs: ['a la carte versus bundles', 'algorithmic discovery versus curation'],
    counterexampleCategories: ['regional licensing gaps', 'artist-friendly platforms'],
    relevantQuestions: ['Who benefits most from the current model?', 'What would fairer creator support look like?'],
    closingChallenges: ['Choose one change to pricing or discovery you would defend.'],
    evaluationGuidance: ['reward industry awareness', 'penalise vague anti-tech rhetoric'],
  },
  'society-social-media': {
    topicKeywords: ['connection', 'polarisation', 'moderation', 'attention', 'misinformation', 'public discourse'],
    commonProClaims: ['enables organising and voice', 'marginalised groups find community', 'markets can improve tools over time'],
    commonContraClaims: ['incentives reward outrage', 'moderation scales poorly', 'public square effects spill offline'],
    assumptions: ['platform design shapes behaviour', 'no perfect moderation rule exists'],
    tradeOffs: ['free expression versus harm reduction', 'user control versus platform responsibility'],
    counterexampleCategories: ['healthy niche communities', 'coordinated harassment campaigns'],
    relevantQuestions: ['Which harms are structural versus individual?', 'What transparency would actually help?'],
    closingChallenges: ['Identify one design or policy lever you would pull first.'],
    evaluationGuidance: ['reward mechanism-based analysis', 'avoid treating all platforms as monoliths'],
  },
  'politics-immigration': {
    topicKeywords: ['border policy', 'labour needs', 'integration', 'humanitarian duty', 'sovereignty', 'public services'],
    commonProClaims: ['migration can fill labour gaps', 'diversity can enrich communities', 'humanitarian obligations matter'],
    commonContraClaims: ['rapid change strains services', 'integration requires resources', 'rules must be predictable'],
    assumptions: ['migration patterns are complex', 'fears and facts both influence debate'],
    tradeOffs: ['openness versus control', 'national policy versus local impact'],
    counterexampleCategories: ['regions with ageing populations', 'integration programmes that succeeded or failed'],
    relevantQuestions: ['Which criteria should govern entry and stay?', 'How should communities receive support?'],
    closingChallenges: ['State one principle that should guide reform and one limit.'],
    evaluationGuidance: ['reward humane specificity', 'penalise dehumanising language'],
  },
  'football-transfers': {
    topicKeywords: ['competitive balance', 'player mobility', 'club finances', 'youth development', 'regulation', 'fans'],
    commonProClaims: ['talent should move to best fit', 'investment can raise league quality', 'players deserve labour freedom'],
    commonContraClaims: ['rich clubs hoard talent', 'smaller clubs lose development upside', 'fee inflation distorts incentives'],
    assumptions: ['sport is both business and community asset', 'rules shape market power'],
    tradeOffs: ['player freedom versus league parity', 'spending caps versus open markets'],
    counterexampleCategories: ['leagues with strict financial rules', 'youth academies losing stars early'],
    relevantQuestions: ['Should competitive balance be a policy goal?', 'How would you protect smaller clubs?'],
    closingChallenges: ['Defend one transfer rule change with predictable effects.'],
    evaluationGuidance: ['reward economic and sporting trade-offs', 'avoid pure fan tribalism'],
  },
  'technology-privacy': {
    topicKeywords: ['surveillance', 'consent', 'security', 'personal data', 'regulation', 'innovation'],
    commonProClaims: ['strong privacy builds trust', 'users should control their data', 'clear rules help ethical companies compete'],
    commonContraClaims: ['security sometimes needs access', 'compliance burdens smaller firms', 'users trade convenience for sharing'],
    assumptions: ['defaults matter more than fine print', 'harms can be invisible until late'],
    tradeOffs: ['personalisation versus minimisation', 'national security versus individual rights'],
    counterexampleCategories: ['breaches after data hoarding', 'privacy-preserving tools that succeed'],
    relevantQuestions: ['What data is truly necessary?', 'Who enforces violations effectively?'],
    closingChallenges: ['Name one right users should have by default.'],
    evaluationGuidance: ['reward concrete safeguards', 'penalise absolutism without exceptions'],
  },
  'wildcards-universal-basic-income': {
    topicKeywords: ['welfare', 'automation', 'dignity', 'work incentives', 'funding', 'bureaucracy'],
    commonProClaims: ['simplifies fragmented benefits', 'provides floor amid disruption', 'respects choice beyond paid work'],
    commonContraClaims: ['cost may require major tax shifts', 'inflation or rent capture risks', 'work incentives worry some voters'],
    assumptions: ['existing systems have gaps', 'design details determine outcomes'],
    tradeOffs: ['universality versus targeting', 'generosity versus fiscal sustainability'],
    counterexampleCategories: ['pilot programmes with mixed results', 'countries with different tax bases'],
    relevantQuestions: ['What would UBI replace or supplement?', 'How would you fund and adjust over time?'],
    closingChallenges: ['Specify one population and payment level you would trial.'],
    evaluationGuidance: ['reward fiscal realism', 'avoid treating UBI as single fixed model'],
  },
  'society-death-penalty': {
    topicKeywords: ['justice', 'deterrence', 'irreversibility', 'victims rights', 'state power', 'incarceration'],
    commonProClaims: ['ultimate punishment for grave crimes', 'potential deterrence effect', 'closure for some victims families'],
    commonContraClaims: ['irreversible error risk', 'uneven application across groups', 'life imprisonment may suffice'],
    assumptions: ['legal systems are fallible', 'moral intuitions differ on state killing'],
    tradeOffs: ['retribution versus rehabilitation', 'finality versus caution'],
    counterexampleCategories: ['exonerations after conviction', 'jurisdictions without capital punishment'],
    relevantQuestions: ['What error rate is acceptable when life is at stake?', 'How should victims voices weigh in policy?'],
    closingChallenges: ['Identify the value that tips the scale for you and one safeguard you would demand.'],
    evaluationGuidance: ['reward respectful moral reasoning', 'penalise vengeance without analysis'],
  },
}

function deriveKeywords(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)
    .slice(0, 8)
}

export function resolveDebatePack(takeId: string, motion: string): DebatePack {
  const keywords = deriveKeywords(motion)
  const curated = CURATED_PACKS[takeId]
  if (curated) {
    return {
      takeId,
      ...curated,
      motionKeywords: keywords,
      topicKeywords: [...new Set([...curated.topicKeywords, ...keywords])],
    }
  }
  const take = takes.find(item => item.id === takeId)
  const categoryKeywords = take ? deriveKeywords(`${take.category} ${take.context}`) : []
  return {
    takeId: take?.id || takeId,
    ...GENERIC_PACK,
    motionKeywords: keywords,
    topicKeywords: [...new Set([...GENERIC_PACK.topicKeywords, ...keywords, ...categoryKeywords])],
  }
}

export type PackValidationIssue = { takeId: string; message: string }

export function validateDebatePacks(locales: readonly Language[]): PackValidationIssue[] {
  const issues: PackValidationIssue[] = []
  for (const take of takes) {
    const pack = resolveDebatePack(take.id, take.statement)
    const lists = [
      pack.motionKeywords,
      pack.topicKeywords,
      pack.commonProClaims,
      pack.commonContraClaims,
      pack.assumptions,
      pack.tradeOffs,
      pack.counterexampleCategories,
      pack.relevantQuestions,
      pack.closingChallenges,
    ]
    if (lists.some(list => !list.length || list.some(entry => !entry.trim()))) {
      issues.push({ takeId: take.id, message: 'Pack contains empty entries.' })
    }
    if (TACTIC_IDS.length < 3) {
      issues.push({ takeId: take.id, message: 'Not enough tactics for three rounds.' })
    }
    if (!locales.length) {
      issues.push({ takeId: take.id, message: 'Locale list missing.' })
    }
  }
  return issues
}

export function validatePrivateTakePack(motion: string): PackValidationIssue[] {
  const pack = resolveDebatePack(`private-${motion.length}`, motion)
  return pack.topicKeywords.length ? [] : [{ takeId: 'private', message: 'Generic private pack failed.' }]
}
