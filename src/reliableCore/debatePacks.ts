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
    topicKeywords: ['compulsory voting', 'turnout', 'legitimacy', 'civic duty', 'abstention', 'enforcement'],
    commonProClaims: ['higher turnout can strengthen representation', 'voting can be treated as civic duty', 'compulsion may reduce polarised mobilisation'],
    commonContraClaims: ['forced participation may not improve informed choice', 'abstention can signal dissent', 'enforcement creates administrative burden'],
    assumptions: ['turnout and legitimacy are related but not identical', 'voting systems differ by country'],
    tradeOffs: ['participation versus freedom to abstain', 'symbolic duty versus meaningful engagement'],
    counterexampleCategories: ['countries with compulsory voting', 'low-turnout elections with stable governance'],
    relevantQuestions: ['Does higher turnout always produce fairer outcomes?', 'What penalties or incentives are proportionate?'],
    closingChallenges: ['Defend whether abstention should remain a meaningful choice and why.'],
    evaluationGuidance: ['reward institutional detail', 'avoid treating turnout as self-evidently good'],
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
  'ai-human-review': {
    topicKeywords: ['automated decisions', 'human oversight', 'accountability', 'scale', 'appeals', 'high-impact systems'],
    commonProClaims: ['humans can catch context machines miss', 'accountability requires a responsible actor', 'review builds public trust'],
    commonContraClaims: ['human review can be slow or rubber-stamp', 'not every decision needs the same scrutiny', 'operators may defer to flawed systems'],
    assumptions: ['automation and oversight can coexist', 'impact varies by domain'],
    tradeOffs: ['speed versus caution', 'uniform rules versus case-by-case review'],
    counterexampleCategories: ['domains with effective human-in-the-loop', 'bottlenecks from mandatory review'],
    relevantQuestions: ['Which decisions must never be fully automated?', 'How should appeals work in practice?'],
    closingChallenges: ['Name one decision type and the review standard you would require.'],
    evaluationGuidance: ['reward proportionate safeguards', 'avoid treating all automation as identical'],
  },
  'climate-home-energy': {
    topicKeywords: ['energy efficiency', 'housing sales', 'retrofit costs', 'landlords', 'emissions', 'standards'],
    commonProClaims: ['standards at sale can cut future emissions', 'buyers benefit from lower running costs', 'policy creates predictable upgrade path'],
    commonContraClaims: ['retrofits are expensive for owners', 'one-size standards may not fit all buildings', 'market may already reward efficiency'],
    assumptions: ['housing stock turns over slowly', 'costs and benefits fall on different actors'],
    tradeOffs: ['climate ambition versus upfront cost', 'mandates versus incentives'],
    counterexampleCategories: ['regions with successful retrofit subsidies', 'older homes with limited upgrade options'],
    relevantQuestions: ['Who should pay for upgrades and when?', 'What standard is achievable without blocking sales?'],
    closingChallenges: ['Defend one minimum standard and how to phase it in.'],
    evaluationGuidance: ['reward practical housing detail', 'penalise vague climate slogans'],
  },
  'gaming-pay-to-win': {
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
  'school-homework': {
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
  'everyday-remote': {
    topicKeywords: ['remote work', 'flexibility', 'collaboration', 'boundaries', 'commuting', 'office culture'],
    commonProClaims: ['flexibility improves wellbeing and focus', 'commute time can be reclaimed', 'talent pools widen beyond location'],
    commonContraClaims: ['collaboration and mentoring may suffer', 'home boundaries blur for some workers', 'not all roles suit remote work'],
    assumptions: ['work arrangements affect teams differently', 'hybrid models are common'],
    tradeOffs: ['freedom versus spontaneous collaboration', 'individual preference versus team needs'],
    counterexampleCategories: ['teams that thrive remotely', 'roles requiring physical presence'],
    relevantQuestions: ['Which tasks truly need co-location?', 'How should employers support fair hybrid norms?'],
    closingChallenges: ['Name one policy that would make remote work fairer for your side.'],
    evaluationGuidance: ['reward workplace realism', 'avoid treating one arrangement as universal'],
  },
  'movies-streaming': {
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
  'internet-feed-controls': {
    topicKeywords: ['algorithmic feeds', 'user agency', 'chronological order', 'discovery', 'attention', 'defaults'],
    commonProClaims: ['users should control how content is ranked', 'chronological feeds reduce manipulation', 'choice supports healthier habits'],
    commonContraClaims: ['algorithms help surface relevant content', 'full opt-out may reduce discovery', 'implementation complexity is real'],
    assumptions: ['defaults shape behaviour', 'not all users want the same experience'],
    tradeOffs: ['personalisation versus transparency', 'platform growth versus user control'],
    counterexampleCategories: ['platforms with successful chronological options', 'users overwhelmed without curation'],
    relevantQuestions: ['What should the default be for new users?', 'How can choice be meaningful rather than buried?'],
    closingChallenges: ['Defend one default setting and one opt-out you would require.'],
    evaluationGuidance: ['reward design literacy', 'avoid treating algorithms as inherently harmful or benign'],
  },
  'politics-citizen-assemblies': {
    topicKeywords: ['citizens assemblies', 'deliberation', 'random selection', 'accountability', 'major decisions', 'representation'],
    commonProClaims: ['diverse citizens can deliberate thoughtfully', 'assemblies can break partisan deadlock', 'process can build legitimacy'],
    commonContraClaims: ['mandates may be unclear or ignored', 'elected accountability remains important', 'selection and briefing shape outcomes'],
    assumptions: ['participation quality depends on design', 'institutions can complement elections'],
    tradeOffs: ['deliberation versus speed', 'advisory versus binding outcomes'],
    counterexampleCategories: ['successful assembly pilots', 'assemblies with limited follow-through'],
    relevantQuestions: ['Which decisions suit assembly input?', 'How should results connect to elected bodies?'],
    closingChallenges: ['Name one decision you would trust to an assembly and one safeguard.'],
    evaluationGuidance: ['reward institutional design', 'avoid idealising or dismissing assemblies wholesale'],
  },
  'football-salary-cap': {
    topicKeywords: ['salary cap', 'competitive balance', 'club spending', 'wage inflation', 'league parity', 'revenue'],
    commonProClaims: ['caps can narrow gaps between clubs', 'spending limits protect league stability', 'smaller clubs get fairer chance'],
    commonContraClaims: ['top talent may leave for uncapped leagues', 'enforcement is complex across structures', 'investment can raise overall quality'],
    assumptions: ['financial rules shape incentives', 'fans value both stars and competition'],
    tradeOffs: ['parity versus star attraction', 'strict caps versus luxury taxes'],
    counterexampleCategories: ['leagues with effective caps', 'clubs circumventing spending rules'],
    relevantQuestions: ['Should competitive balance trump individual club ambition?', 'How would you enforce caps fairly?'],
    closingChallenges: ['Defend one cap mechanism and its likely trade-off.'],
    evaluationGuidance: ['reward economic and sporting trade-offs', 'avoid pure fan tribalism'],
  },
  'ai-privacy-defaults': {
    topicKeywords: ['privacy by default', 'personal data', 'AI assistants', 'consent', 'personalisation', 'trust'],
    commonProClaims: ['private defaults build user trust', 'users should opt in to data use', 'minimisation reduces breach harm'],
    commonContraClaims: ['personalisation needs some data to work', 'users often accept convenience', 'competitors may offer richer defaults'],
    assumptions: ['defaults shape real behaviour', 'assistants vary in data needs'],
    tradeOffs: ['utility versus minimisation', 'user control versus seamless experience'],
    counterexampleCategories: ['assistants that work with local-only data', 'features that require cloud history'],
    relevantQuestions: ['What data is essential for core features?', 'How should users review what is stored?'],
    closingChallenges: ['Name one data type that should stay off-device by default.'],
    evaluationGuidance: ['reward concrete safeguards', 'penalise vague privacy rhetoric'],
  },
  'economics-basic-income': {
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
  'society-school-ai': {
    topicKeywords: ['AI homework', 'digital literacy', 'independent thinking', 'school policy', 'cheating', 'skills'],
    commonProClaims: ['students need fluency with future tools', 'guided use can teach critical evaluation', 'banning may widen inequality'],
    commonContraClaims: ['overuse can weaken independent thinking', 'cheating detection is uneven', 'not all teachers can supervise equally'],
    assumptions: ['schools shape habits early', 'tool access varies by home environment'],
    tradeOffs: ['skill-building versus academic integrity', 'open use versus restricted policies'],
    counterexampleCategories: ['classrooms with structured AI assignments', 'assignments where AI undermines learning goals'],
    relevantQuestions: ['When does assistance become substitution?', 'What guidance should teachers give?'],
    closingChallenges: ['Propose one classroom rule for AI use you would defend.'],
    evaluationGuidance: ['reward educational realism', 'avoid treating AI as all-helpful or all-harmful'],
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
