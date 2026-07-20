import { z } from 'zod'
import { localizeTake } from './i18n'
import type { WorldPulseSnapshot } from './worldPulse'

export type Mode = 'classic' | 'sideswitch' | 'blindside' | 'commonground'
export type Stance = -2 | -1 | 0 | 1 | 2
export type Language = 'en' | 'de' | 'fr' | 'es' | 'it'
export type AiDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type AiRoundLength = 'quick' | 'standard' | 'deep'
export type AiQuality = 'fast' | 'balanced' | 'maximum'
export type AiResponseLength = 'concise' | 'standard' | 'detailed'

export type AiEvaluationData = {
  clarity: number
  relevance: number
  reasoning: number
  rebuttal: number
  fairness: number
  strongestPoint: string
  weakestAssumption: string
  missedCounterargument: string
  improvedExampleResponse: string
  argumentDna: string
  unansweredOpponentPoint?: string
  concession?: 'user' | 'opponent' | 'both' | 'none'
}

export type AiTurnData = { role: 'user' | 'opponent'; round: number; content: string; interrupted?: boolean }

export type AiDebateData = {
  opponentId: string
  family: string
  modelId: string
  difficulty: AiDifficulty
  roundLength: AiRoundLength
  quality: AiQuality
  responseLength: AiResponseLength
  modelSelection: 'automatic' | 'exact'
  roundLimit: number
  userSide: string
  aiSide: string
  customMotion: string | null
  transcript: AiTurnData[]
  partialResponse: string
  interrupted: boolean
  completionReason: 'completed' | 'abandoned' | 'interrupted' | null
}

export type Take = {
  id: string
  category: string
  categoryDe: string
  categoryClass: string
  statement: string
  statementDe: string
  context: string
  contextDe: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  time: string
  type: string
  color: string
  supportLabel: string
  opposeLabel: string
  worldPulse?: WorldPulseSnapshot
}

export type TranscriptTurn = {
  role: 'user' | 'opponent'
  round: number
  content: string
}

export type ScoreBreakdown = {
  label: string
  score: number
  explanation: string
}

export type ResultData = {
  id: string
  debateId?: string
  score: number | null
  movement: number
  understanding: string
  mode: Mode
  take: Take
  assignedSide: string
  transcript: TranscriptTurn[]
  scores: ScoreBreakdown[]
  coaching: string
  completedAt: string
  ai?: {
    opponentId: string
    family: string
    modelId: string
    difficulty: AiDifficulty
    roundLength: AiRoundLength
    quality: AiQuality
    responseLength: AiResponseLength
    modelSelection: 'automatic' | 'exact'
    roundLimit: number
    customMotion?: string | null
    evaluationAvailable: boolean
    evaluation?: AiEvaluationData
  }
}

export type DebateSnapshot = {
  id: string
  takeId: string
  mode: Mode
  step: number
  stance: Stance
  postStance: Stance
  confidence: number
  understanding: string
  responses: Record<number, string>
  opponentMessages: Record<number, string>
  assignedSide: string
  language: Language
  status: 'active' | 'completed'
  updatedAt: string
  worldPulse?: WorldPulseSnapshot
  ai?: AiDebateData
}

export const opponentSchema = z.object({
  response: z.string().min(1).max(700),
  question: z.string().min(1).max(260),
  round: z.number().int().min(1).max(5),
  language: z.enum(['en', 'de', 'fr', 'es', 'it']),
})

export const judgeSchema = z.object({
  total: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  scores: z.array(z.object({
    label: z.enum(['Clarity', 'Relevance', 'Reasoning', 'Rebuttal', 'Fairness']),
    score: z.number().int().min(0).max(20),
    explanation: z.string().min(1).max(260),
  })).length(5),
  strongestPoints: z.array(z.string().min(1).max(260)).max(3),
  coaching: z.string().min(1).max(400),
})

const t = (
  id: string,
  category: string,
  categoryDe: string,
  categoryClass: string,
  statement: string,
  statementDe: string,
  context: string,
  contextDe: string,
  difficulty: Take['difficulty'],
  time: string,
  type: string,
  color: string,
  supportLabel = 'Support the statement',
  opposeLabel = 'Oppose the statement',
): Take => ({ id, category, categoryDe, categoryClass, statement, statementDe, context, contextDe, difficulty, time, type, color, supportLabel, opposeLabel })

export const interestOptions = [
  'Politics and Democracy', 'Civil Rights and Equality', 'LGBTQ+ Rights', 'Women\'s Rights and Gender Equality',
  'Climate and Environment', 'Football', 'Gaming', 'AI and Technology', 'Movies and Series', 'Music and Culture',
  'Relationships and Everyday Life', 'Ethics and Philosophy', 'School and Education', 'Internet and Social Media',
  'Economics and Inequality', 'Wildcards',
] as const

const extraTakes: Take[] = [
  t('politics-voting-age', 'Politics and Democracy', 'Politik und Demokratie', 'category-coral', 'Voting should be compulsory in national elections.', 'Bei nationalen Wahlen sollte Wahlpflicht gelten.', 'Participation can strengthen legitimacy, while abstention can also be a meaningful choice.', 'Beteiligung kann Legitimität stärken, während Nichtwählen auch eine bewusste Entscheidung sein kann.', 'Medium', '5 min', 'Democracy', 'coral'),
  t('politics-citizen-assemblies', 'Politics and Democracy', 'Politik und Demokratie', 'category-coral', 'Citizens’ assemblies should guide major national decisions.', 'Bürgerräte sollten wichtige nationale Entscheidungen mitgestalten.', 'Randomly selected citizens can broaden debate, but elected accountability still matters.', 'Zufällig ausgewählte Bürger können Debatten verbreitern, aber demokratische Verantwortung bleibt wichtig.', 'Hard', '6 min', 'Democracy', 'coral'),
  t('politics-local-power', 'Politics and Democracy', 'Politik und Demokratie', 'category-coral', 'More public decisions should be made at local level.', 'Mehr öffentliche Entscheidungen sollten lokal getroffen werden.', 'Local knowledge can improve choices, while national standards protect equal treatment.', 'Lokales Wissen kann Entscheidungen verbessern, während nationale Standards Gleichbehandlung schützen.', 'Medium', '5 min', 'Policy', 'coral'),
  t('politics-coalitions', 'Politics and Democracy', 'Politik und Demokratie', 'category-coral', 'Coalition governments produce better compromises.', 'Koalitionsregierungen führen zu besseren Kompromissen.', 'Shared power can moderate policy, while compromise can also blur responsibility.', 'Geteilte Macht kann Politik ausgleichen, aber Kompromisse können Verantwortung verwischen.', 'Medium', '5 min', 'Democracy', 'coral'),
  t('civil-equal-access', 'Civil Rights and Equality', 'Bürgerrechte und Gleichheit', 'category-mint', 'Public services should be designed for the least advantaged user first.', 'Öffentliche Dienste sollten zuerst für die am stärksten benachteiligten Nutzer gestaltet werden.', 'Universal design can widen access, while resources and competing needs still require choices.', 'Universelles Design kann Zugang erweitern, während Ressourcen und Bedürfnisse Entscheidungen erfordern.', 'Medium', '5 min', 'Rights', 'mint'),
  t('civil-protest-space', 'Civil Rights and Equality', 'Bürgerrechte und Gleichheit', 'category-mint', 'Public protest should be protected even when it causes disruption.', 'Öffentlicher Protest sollte auch bei Störungen geschützt werden.', 'Disruption can make overlooked issues visible, while others also have rights to safety and access.', 'Störungen können übersehene Probleme sichtbar machen, während andere ebenfalls Rechte auf Sicherheit und Zugang haben.', 'Hard', '6 min', 'Rights', 'mint'),
  t('civil-accessibility', 'Civil Rights and Equality', 'Bürgerrechte und Gleichheit', 'category-mint', 'Accessibility should be a legal requirement for every digital service.', 'Barrierefreiheit sollte für jeden digitalen Dienst gesetzlich vorgeschrieben sein.', 'Requirements create accountability, while small teams may need practical transition paths.', 'Vorgaben schaffen Verantwortung, während kleine Teams praktikable Übergänge brauchen.', 'Medium', '5 min', 'Policy', 'mint'),
  t('lgbtq-school-names', 'LGBTQ+ Rights', 'LGBTQ+-Rechte', 'category-lavender', 'Schools should let students use their chosen names without parental permission.', 'Schulen sollten gewählte Namen ohne Zustimmung der Eltern verwenden lassen.', 'Respect and safety matter, while families and schools may disagree about support.', 'Respekt und Sicherheit zählen, während Familien und Schulen unterschiedliche Ansichten haben können.', 'Hard', '6 min', 'Rights', 'lavender'),
  t('lgbtq-pride-public', 'LGBTQ+ Rights', 'LGBTQ+-Rechte', 'category-lavender', 'Public institutions should visibly support Pride events.', 'Öffentliche Einrichtungen sollten Pride-Veranstaltungen sichtbar unterstützen.', 'Visibility can signal belonging, while institutions also serve people with varied views.', 'Sichtbarkeit kann Zugehörigkeit signalisieren, während Einrichtungen Menschen mit verschiedenen Ansichten dienen.', 'Medium', '5 min', 'Culture', 'lavender'),
  t('lgbtq-sport-policy', 'LGBTQ+ Rights', 'LGBTQ+-Rechte', 'category-lavender', 'Youth sports should prioritize inclusion over rigid category rules.', 'Jugendsport sollte Inklusion über starre Kategorien stellen.', 'Participation supports wellbeing, while fair competition needs thoughtful rules.', 'Teilnahme unterstützt Wohlbefinden, während fairer Wettbewerb durchdachte Regeln braucht.', 'Hard', '6 min', 'Policy', 'lavender'),
  t('women-parental-leave', 'Women’s Rights and Gender Equality', 'Frauenrechte und Geschlechtergerechtigkeit', 'category-coral', 'Parental leave should be equal for all parents.', 'Elternzeit sollte für alle Eltern gleich geregelt sein.', 'Equal leave can rebalance care work, while families may need flexibility.', 'Gleiche Elternzeit kann Sorgearbeit ausgleichen, während Familien Flexibilität brauchen.', 'Medium', '5 min', 'Policy', 'coral'),
  t('women-pay-transparency', 'Women’s Rights and Gender Equality', 'Frauenrechte und Geschlechtergerechtigkeit', 'category-coral', 'Employers should publish salary ranges for every role.', 'Arbeitgeber sollten Gehaltsspannen für jede Stelle veröffentlichen.', 'Transparency can reduce unfair gaps, while roles and experience can be difficult to compare.', 'Transparenz kann ungerechte Unterschiede verringern, während Rollen und Erfahrung schwer vergleichbar sein können.', 'Medium', '5 min', 'Work', 'coral'),
  t('women-care-work', 'Women’s Rights and Gender Equality', 'Frauenrechte und Geschlechtergerechtigkeit', 'category-coral', 'Unpaid care work should count toward public pension benefits.', 'Unbezahlte Sorgearbeit sollte bei der staatlichen Rente berücksichtigt werden.', 'Care creates social value, while funding and eligibility need clear boundaries.', 'Sorgearbeit schafft gesellschaftlichen Wert, während Finanzierung und Anspruch klare Grenzen brauchen.', 'Hard', '6 min', 'Policy', 'coral'),
  t('climate-home-energy', 'Climate and Environment', 'Klima und Umwelt', 'category-mint', 'Homes should meet minimum energy-efficiency standards when sold.', 'Wohnungen sollten beim Verkauf Mindeststandards für Energieeffizienz erfüllen.', 'Standards can lower future emissions, while upgrades can be expensive for owners.', 'Standards können künftige Emissionen senken, während Sanierungen Eigentümer belasten können.', 'Medium', '5 min', 'Climate', 'mint'),
  t('climate-meat-tax', 'Climate and Environment', 'Klima und Umwelt', 'category-mint', 'A small climate tax on high-emission foods is justified.', 'Eine kleine Klimasteuer auf emissionsreiche Lebensmittel ist gerechtfertigt.', 'Prices can shift habits, while food policy must avoid unfair burdens.', 'Preise können Gewohnheiten verändern, während Ernährungspolitik faire Lasten beachten muss.', 'Hard', '6 min', 'Climate', 'mint'),
  t('climate-rewilding', 'Climate and Environment', 'Klima und Umwelt', 'category-mint', 'Rewilding should take priority over intensive land management.', 'Renaturierung sollte Vorrang vor intensiver Landnutzung haben.', 'Restored ecosystems can build resilience, while communities depend on productive land.', 'Erholte Ökosysteme können widerstandsfähiger machen, während Gemeinden produktives Land brauchen.', 'Medium', '5 min', 'Environment', 'mint'),
  t('ai-assistants-school', 'AI and Technology', 'KI und Technologie', 'category-coral', 'AI assistants should be taught as a basic digital literacy skill.', 'KI-Assistenten sollten als digitale Grundkompetenz vermittelt werden.', 'Understanding tools can reduce misuse, while schools must protect independent thinking.', 'Werkzeugverständnis kann Missbrauch verringern, während Schulen eigenständiges Denken schützen müssen.', 'Medium', '5 min', 'Technology', 'coral'),
  t('ai-privacy-defaults', 'AI and Technology', 'KI und Technologie', 'category-coral', 'Personal AI assistants should keep data private by default.', 'Persönliche KI-Assistenten sollten Daten standardmäßig privat halten.', 'Privacy builds trust, while personalization often depends on useful data.', 'Privatsphäre schafft Vertrauen, während Personalisierung oft nützliche Daten braucht.', 'Medium', '5 min', 'Technology', 'coral'),
  t('ai-human-review', 'AI and Technology', 'KI und Technologie', 'category-coral', 'High-impact automated decisions should always have human review.', 'Entscheidungen mit großer Wirkung sollten immer menschlich geprüft werden.', 'Human review can catch harm, while scale and speed make every review difficult.', 'Menschliche Prüfung kann Schäden erkennen, während Umfang und Geschwindigkeit jede Prüfung erschweren.', 'Hard', '6 min', 'Ethics', 'coral'),
  t('ai-open-source', 'AI and Technology', 'KI und Technologie', 'category-coral', 'Important AI systems should be open source.', 'Wichtige KI-Systeme sollten quelloffen sein.', 'Openness supports scrutiny, while unrestricted access can increase misuse.', 'Offenheit erleichtert Kontrolle, während uneingeschränkter Zugang Missbrauch erhöhen kann.', 'Hard', '6 min', 'Technology', 'coral'),
  t('movies-streaming', 'Movies and Series', 'Filme und Serien', 'category-lavender', 'Streaming services should release films in cinemas first.', 'Streamingdienste sollten Filme zuerst im Kino veröffentlichen.', 'Cinemas create shared experiences, while home release improves access and choice.', 'Kinos schaffen gemeinsame Erlebnisse, während Heimveröffentlichungen Zugang und Auswahl verbessern.', 'Easy', '4 min', 'Culture', 'lavender'),
  t('movies-spoilers', 'Movies and Series', 'Filme und Serien', 'category-lavender', 'Creators should be allowed to redesign famous stories completely.', 'Kreative sollten bekannte Geschichten vollständig neu gestalten dürfen.', 'Fresh interpretations can keep stories alive, while audiences value continuity.', 'Neue Interpretationen können Geschichten lebendig halten, während Publikum Kontinuität schätzt.', 'Medium', '5 min', 'Culture', 'lavender'),
  t('movies-awards', 'Movies and Series', 'Filme und Serien', 'category-lavender', 'Popular films deserve as much critical attention as art-house films.', 'Populäre Filme verdienen ebenso viel kritische Aufmerksamkeit wie Arthouse-Filme.', 'Popularity can reflect craft and connection, while difficulty is not the same as quality.', 'Popularität kann Können und Verbindung zeigen, während Schwierigkeit nicht dasselbe wie Qualität ist.', 'Easy', '4 min', 'Culture', 'lavender'),
  t('music-algorithms', 'Music and Culture', 'Musik und Kultur', 'category-yellow', 'Music discovery algorithms make listening more interesting.', 'Algorithmen zur Musikentdeckung machen Hören interessanter.', 'Recommendations reveal new work, while familiar patterns can narrow taste.', 'Empfehlungen zeigen neue Werke, während vertraute Muster Geschmack verengen können.', 'Easy', '4 min', 'Culture', 'yellow'),
  t('music-live', 'Music and Culture', 'Musik und Kultur', 'category-yellow', 'Live music is worth paying more for than recorded music.', 'Livemusik ist höhere Preise wert als aufgenommene Musik.', 'Shared presence is unique, while recordings are more accessible and repeatable.', 'Gemeinsame Präsenz ist einzigartig, während Aufnahmen zugänglicher und wiederholbar sind.', 'Easy', '4 min', 'Culture', 'yellow'),
  t('music-canon', 'Music and Culture', 'Musik und Kultur', 'category-yellow', 'Every generation should question the established cultural canon.', 'Jede Generation sollte den etablierten Kulturkanon hinterfragen.', 'New voices broaden understanding, while older work can still carry lasting value.', 'Neue Stimmen erweitern Verständnis, während ältere Werke bleibenden Wert haben können.', 'Medium', '5 min', 'Culture', 'yellow'),
  t('ethics-intentions', 'Ethics and Philosophy', 'Ethik und Philosophie', 'category-mint', 'Good intentions matter as much as outcomes.', 'Gute Absichten zählen ebenso wie Ergebnisse.', 'Intentions reveal character, while consequences are what others experience.', 'Absichten zeigen Charakter, während Folgen das sind, was andere erleben.', 'Medium', '5 min', 'Ethics', 'mint'),
  t('ethics-forgiveness', 'Ethics and Philosophy', 'Ethik und Philosophie', 'category-mint', 'Forgiveness is a strength rather than a weakness.', 'Vergebung ist eine Stärke und keine Schwäche.', 'Letting go can restore agency, while boundaries may still be necessary.', 'Loslassen kann Selbstbestimmung zurückgeben, während Grenzen weiterhin nötig sein können.', 'Medium', '5 min', 'Ethics', 'mint'),
  t('ethics-truth', 'Ethics and Philosophy', 'Ethik und Philosophie', 'category-mint', 'Telling the truth is always better than protecting feelings.', 'Die Wahrheit zu sagen ist immer besser, als Gefühle zu schützen.', 'Honesty supports trust, while timing and compassion shape its value.', 'Ehrlichkeit unterstützt Vertrauen, während Zeitpunkt und Mitgefühl ihren Wert prägen.', 'Easy', '4 min', 'Ethics', 'mint'),
  t('school-exams', 'School and Education', 'Schule und Bildung', 'category-blue', 'Schools should replace most exams with project work.', 'Schulen sollten die meisten Prüfungen durch Projektarbeit ersetzen.', 'Projects show collaboration and application, while exams offer consistent comparison.', 'Projekte zeigen Zusammenarbeit und Anwendung, während Prüfungen Vergleichbarkeit bieten.', 'Medium', '5 min', 'Education', 'blue'),
  t('school-homework', 'School and Education', 'Schule und Bildung', 'category-blue', 'Homework should be optional after primary school.', 'Hausaufgaben sollten nach der Grundschule freiwillig sein.', 'Free time supports wellbeing, while practice outside class can consolidate learning.', 'Freizeit unterstützt Wohlbefinden, während Übung außerhalb des Unterrichts Lernen festigen kann.', 'Easy', '4 min', 'Education', 'blue'),
  t('school-choice', 'School and Education', 'Schule und Bildung', 'category-blue', 'Students should help choose what they study each term.', 'Schüler sollten mitentscheiden, was sie jedes Schulhalbjahr lernen.', 'Choice can build motivation, while a common foundation protects opportunity.', 'Wahlmöglichkeiten können motivieren, während eine gemeinsame Basis Chancen schützt.', 'Medium', '5 min', 'Education', 'blue'),
  t('internet-real-names', 'Internet and Social Media', 'Internet und soziale Medien', 'category-lavender', 'Social platforms should offer real-name verification without requiring public real names.', 'Soziale Plattformen sollten eine Namensprüfung anbieten, ohne öffentliche Klarnamen zu verlangen.', 'Verification can reduce abuse, while private pseudonyms protect vulnerable users.', 'Prüfung kann Missbrauch verringern, während private Pseudonyme verletzliche Nutzer schützen.', 'Hard', '6 min', 'Policy', 'lavender'),
  t('internet-feed-controls', 'Internet and Social Media', 'Internet und soziale Medien', 'category-lavender', 'Users should be able to turn off algorithmic feeds completely.', 'Nutzer sollten algorithmische Feeds vollständig abschalten können.', 'Choice supports agency, while curated feeds can help people find relevant information.', 'Wahlfreiheit stärkt Selbstbestimmung, während kuratierte Feeds relevante Informationen auffindbar machen.', 'Medium', '5 min', 'Technology', 'lavender'),
  t('internet-creator-pay', 'Internet and Social Media', 'Internet und soziale Medien', 'category-lavender', 'Platforms should share more advertising revenue with creators.', 'Plattformen sollten mehr Werbeeinnahmen mit Kreativen teilen.', 'Creators provide value and attract audiences, while platforms carry infrastructure costs.', 'Kreative schaffen Wert und Publikum, während Plattformen Infrastruktur finanzieren.', 'Medium', '5 min', 'Economics', 'lavender'),
  t('internet-screen-breaks', 'Internet and Social Media', 'Internet und soziale Medien', 'category-lavender', 'Social apps should include default evening break reminders.', 'Soziale Apps sollten standardmäßig abendliche Pausenerinnerungen enthalten.', 'Gentle friction may support balance, while adults should control their own routines.', 'Sanfte Reibung kann Balance unterstützen, während Erwachsene ihre Routinen selbst steuern sollten.', 'Easy', '4 min', 'Everyday', 'lavender'),
  t('economics-four-day', 'Economics and Inequality', 'Wirtschaft und Ungleichheit', 'category-yellow', 'A four-day work week should become the default.', 'Eine Vier-Tage-Woche sollte zum Standard werden.', 'Shorter weeks may improve wellbeing and focus, while some services need different coverage.', 'Kürzere Wochen könnten Wohlbefinden und Fokus verbessern, aber manche Dienste brauchen andere Abdeckung.', 'Medium', '5 min', 'Work', 'yellow'),
  t('economics-basic-income', 'Economics and Inequality', 'Wirtschaft und Ungleichheit', 'category-yellow', 'A basic income would simplify social support.', 'Ein Grundeinkommen würde soziale Unterstützung vereinfachen.', 'A floor can reduce insecurity, while funding and incentives need careful design.', 'Ein Fundament kann Unsicherheit verringern, während Finanzierung und Anreize sorgfältig gestaltet werden müssen.', 'Hard', '6 min', 'Policy', 'yellow'),
  t('economics-wealth-tax', 'Economics and Inequality', 'Wirtschaft und Ungleichheit', 'category-yellow', 'A moderate wealth tax is fairer than higher income tax.', 'Eine moderate Vermögensteuer ist gerechter als eine höhere Einkommensteuer.', 'Wealth reflects accumulated advantage, while valuation and investment effects are complex.', 'Vermögen spiegelt angesammelte Vorteile wider, während Bewertung und Investitionseffekte komplex sind.', 'Hard', '6 min', 'Policy', 'yellow'),
  t('wildcard-small-talk', 'Wildcards', 'Überraschungen', 'category-mint', 'Small talk is an underrated way to build trust.', 'Smalltalk ist eine unterschätzte Art, Vertrauen aufzubauen.', 'Brief conversations can open doors, while meaningful connection needs more than politeness.', 'Kurze Gespräche können Türen öffnen, während echte Verbindung mehr als Höflichkeit braucht.', 'Easy', '4 min', 'Life', 'mint'),
]

export const takes: Take[] = [
  t('football-var', 'Football', 'Fußball', 'category-yellow', 'VAR has improved football overall.', 'Der VAR hat den Fußball insgesamt verbessert.', 'Accuracy matters, but rhythm, emotion and the referee’s role have changed.', 'Genauigkeit zählt, aber Rhythmus, Emotionen und die Rolle der Schiedsrichter haben sich verändert.', 'Medium', '5 min', 'Opinion', 'yellow'),
  t('football-salary-cap', 'Football', 'Fußball', 'category-yellow', 'Football clubs should have a strict salary cap.', 'Fußballvereine sollten eine strikte Gehaltsobergrenze haben.', 'A cap could improve competition, while clubs differ in income and ambition.', 'Eine Obergrenze könnte den Wettbewerb verbessern, aber Vereine unterscheiden sich bei Einnahmen und Zielen.', 'Hard', '6 min', 'Policy', 'yellow'),
  t('football-international', 'Football', 'Fußball', 'category-yellow', 'International football is more meaningful than club football.', 'Nationalmannschaftsfußball ist bedeutungsvoller als Vereinsfußball.', 'National identity creates rare shared moments; club football offers deeper continuity.', 'Nationalstolz schafft seltene gemeinsame Momente; Vereinsfußball bietet mehr Kontinuität.', 'Medium', '5 min', 'Culture', 'yellow'),
  t('football-loyalty', 'Football', 'Fußball', 'category-yellow', 'Players owe loyalty to the clubs that developed them.', 'Spieler schulden den Vereinen, die sie ausgebildet haben, Loyalität.', 'Development creates real ties, but careers are short and players have limited control.', 'Ausbildung schafft echte Bindungen, aber Karrieren sind kurz und Spieler haben nur begrenzte Kontrolle.', 'Easy', '4 min', 'Culture', 'yellow'),
  t('football-owners', 'Football', 'Fußball', 'category-yellow', 'Financially powerful owners make football less competitive.', 'Finanzstarke Eigentümer machen den Fußball weniger wettbewerbsfähig.', 'Investment can raise standards while widening the gap between clubs.', 'Investitionen können Standards erhöhen und zugleich den Abstand zwischen Vereinen vergrößern.', 'Medium', '5 min', 'Policy', 'yellow'),
  t('football-homegrown', 'Football', 'Fußball', 'category-yellow', 'Every club should start a minimum number of homegrown players.', 'Jeder Verein sollte eine Mindestzahl eigener Nachwuchsspieler einsetzen.', 'Local pathways support development, but rigid quotas can reduce tactical flexibility.', 'Lokale Wege fördern Nachwuchs, aber starre Quoten können taktische Flexibilität verringern.', 'Medium', '5 min', 'Policy', 'yellow'),
  t('football-replays', 'Football', 'Fußball', 'category-yellow', 'Football matches should use shorter halves with more stoppage time.', 'Fußballspiele sollten kürzere Halbzeiten mit mehr Nachspielzeit haben.', 'More active minutes could help attention, but tradition and pacing matter.', 'Mehr aktive Minuten könnten helfen, aber Tradition und Spielrhythmus zählen ebenfalls.', 'Hard', '6 min', 'Format', 'yellow'),
  t('football-coaches', 'Football', 'Fußball', 'category-yellow', 'A manager’s tactics matter more than a team’s individual talent.', 'Die Taktik eines Trainers zählt mehr als das individuelle Talent eines Teams.', 'Structure can unlock players, but exceptional skill can change a match alone.', 'Struktur kann Spieler besser machen, aber außergewöhnliches Talent kann ein Spiel allein entscheiden.', 'Easy', '4 min', 'Opinion', 'yellow'),
  t('gaming-easy-mode', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Difficult games should always include an easy mode.', 'Schwierige Spiele sollten immer einen einfachen Modus enthalten.', 'Accessibility opens the door for more players. Challenge can also be part of creative intent.', 'Barrierefreiheit öffnet Spiele für mehr Menschen. Herausforderung kann aber Teil der Gestaltung sein.', 'Easy', '4 min', 'Culture', 'lavender'),
  t('gaming-pay-to-win', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Games should never contain pay-to-win purchases.', 'Spiele sollten niemals Pay-to-win-Käufe enthalten.', 'Fair competition is valuable, but optional monetisation can fund ongoing support.', 'Fairer Wettbewerb ist wichtig, aber optionale Monetarisierung kann laufende Entwicklung finanzieren.', 'Medium', '5 min', 'Ethics', 'lavender'),
  t('gaming-ai-assets', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'AI-generated assets can belong in professional games.', 'KI-generierte Inhalte können in professionelle Spiele gehören.', 'New tools can expand production, while authorship, consent and quality remain open questions.', 'Neue Werkzeuge können Produktionen erweitern, während Urheberschaft, Zustimmung und Qualität offen bleiben.', 'Hard', '6 min', 'Ethics', 'lavender'),
  t('gaming-exclusives', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Console-exclusive games are good for the industry.', 'Konsolenexklusive Spiele sind gut für die Branche.', 'Exclusives fund distinctive work, but access and player choice are reduced.', 'Exklusivtitel finanzieren besondere Werke, schränken aber Zugang und Wahl ein.', 'Medium', '5 min', 'Business', 'lavender'),
  t('gaming-reviews', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Game reviews should be published only after release.', 'Spielrezensionen sollten erst nach der Veröffentlichung erscheinen.', 'Waiting can reflect the final product, while early reviews help people decide.', 'Warten kann das fertige Produkt besser abbilden, aber frühe Tests helfen bei Entscheidungen.', 'Easy', '4 min', 'Culture', 'lavender'),
  t('gaming-remakes', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Remakes should change enough to justify their existence.', 'Remakes sollten genug verändern, um ihre Existenz zu rechtfertigen.', 'Fresh design can welcome new players, while faithful preservation has its own value.', 'Frisches Design kann neue Spieler gewinnen, während Bewahrung ebenfalls wertvoll ist.', 'Medium', '5 min', 'Culture', 'lavender'),
  t('gaming-streaming', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Game streaming will replace most console ownership.', 'Game-Streaming wird den Besitz von Konsolen größtenteils ersetzen.', 'Convenience and access are strong, but latency, cost and ownership still matter.', 'Bequemlichkeit und Zugang sind stark, aber Latenz, Kosten und Besitz bleiben wichtig.', 'Medium', '5 min', 'Technology', 'lavender'),
  t('gaming-achievements', 'Gaming & internet', 'Gaming & Internet', 'category-lavender', 'Achievements make games more enjoyable.', 'Erfolge machen Spiele unterhaltsamer.', 'Optional goals can add structure, but they can also turn play into a checklist.', 'Optionale Ziele können Struktur geben, aber Spielen auch in eine Checkliste verwandeln.', 'Easy', '4 min', 'Culture', 'lavender'),
  t('everyday-ex', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'It is possible to remain close friends with an ex.', 'Es ist möglich, mit einer Ex-Partnerin oder einem Ex-Partner eng befreundet zu bleiben.', 'Some friendships grow from shared history. Others keep old expectations alive.', 'Manche Freundschaften wachsen aus gemeinsamer Geschichte. Andere halten alte Erwartungen am Leben.', 'Medium', '4 min', 'Everyday', 'blue'),
  t('everyday-passwords', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Couples should know each other’s phone passwords.', 'Paare sollten die Handy-Passwörter des jeweils anderen kennen.', 'Transparency can reassure people, while privacy is also part of trust.', 'Transparenz kann Sicherheit geben, aber Privatsphäre gehört ebenfalls zu Vertrauen.', 'Medium', '5 min', 'Relationships', 'blue'),
  t('everyday-cancel', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Cancelling plans at the last minute is usually disrespectful.', 'Pläne kurzfristig abzusagen ist meistens respektlos.', 'Reliability matters, but emergencies and changing capacity are real.', 'Zuverlässigkeit zählt, aber Notfälle und veränderte Belastbarkeit sind real.', 'Easy', '4 min', 'Everyday', 'blue'),
  t('everyday-truth', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Friends should always tell each other uncomfortable truths.', 'Freunde sollten sich immer unangenehme Wahrheiten sagen.', 'Honesty can protect a friendship, but timing and kindness change how truth lands.', 'Ehrlichkeit kann Freundschaften schützen, aber Zeitpunkt und Freundlichkeit verändern ihre Wirkung.', 'Medium', '5 min', 'Relationships', 'blue'),
  t('everyday-later-school', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Schools should begin later in the morning.', 'Schulen sollten morgens später beginnen.', 'Sleep and learning may improve, while families and schedules need to adapt.', 'Schlaf und Lernen könnten sich verbessern, aber Familien und Tagespläne müssten sich anpassen.', 'Easy', '4 min', 'Policy', 'blue'),
  t('everyday-remote', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Working from home is better than working in an office.', 'Arbeiten von zu Hause ist besser als Arbeiten im Büro.', 'Flexibility helps many people, while collaboration and boundaries can suffer.', 'Flexibilität hilft vielen Menschen, während Zusammenarbeit und Grenzen leiden können.', 'Medium', '5 min', 'Everyday', 'blue'),
  t('everyday-busy', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'Being busy is too often treated as a sign of success.', 'Beschäftigt zu sein gilt zu oft als Zeichen von Erfolg.', 'Full schedules can reflect purpose, but busyness is not the same as value.', 'Volle Kalender können Sinn zeigen, aber Beschäftigung ist nicht dasselbe wie Wert.', 'Easy', '4 min', 'Culture', 'blue'),
  t('everyday-apologies', 'Everyday life & relationships', 'Alltag & Beziehungen', 'category-blue', 'A sincere apology should always be accepted.', 'Eine aufrichtige Entschuldigung sollte immer angenommen werden.', 'Repair deserves a chance, but acceptance does not require renewed trust.', 'Wiedergutmachung verdient eine Chance, aber Annahme erfordert kein neues Vertrauen.', 'Medium', '5 min', 'Relationships', 'blue'),
  t('society-media-age', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'Social media should be restricted to users aged 16 and above.', 'Soziale Medien sollten erst ab 16 Jahren erlaubt sein.', 'Supporters focus on safety and wellbeing. Opponents focus on access, autonomy and enforceability.', 'Befürworter betonen Schutz und Wohlbefinden. Gegner betonen Zugang, Selbstbestimmung und Umsetzbarkeit.', 'Medium', '5 min', 'Policy', 'coral'),
  t('society-ai-art', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'AI-generated art should qualify for major awards.', 'KI-generierte Kunst sollte für große Preise zugelassen werden.', 'New tools can expand creativity. Authorship and process still matter to many artists.', 'Neue Werkzeuge können Kreativität erweitern. Urheberschaft und Prozess sind für viele Künstler wichtig.', 'Hard', '6 min', 'Ethics', 'coral'),
  t('society-free-transit', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'Public transport should be free at the point of use.', 'Öffentlicher Verkehr sollte bei der Nutzung kostenlos sein.', 'Free access can reduce barriers, while funding and capacity still need an answer.', 'Kostenloser Zugang kann Hürden senken, während Finanzierung und Kapazität geklärt werden müssen.', 'Medium', '5 min', 'Policy', 'coral'),
  t('society-anonymous', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'Governments should be allowed to ban anonymous social-media accounts.', 'Regierungen sollten anonyme Social-Media-Konten verbieten dürfen.', 'Accountability may reduce abuse, while anonymity can protect vulnerable speakers.', 'Verantwortlichkeit kann Missbrauch senken, während Anonymität verletzliche Stimmen schützen kann.', 'Hard', '6 min', 'Policy', 'coral'),
  t('society-school-ai', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'Students should be allowed to use AI for homework.', 'Schüler sollten KI für Hausaufgaben nutzen dürfen.', 'Using AI can build future skills, while overuse may weaken independent thinking.', 'KI kann Zukunftskompetenzen fördern, aber Übernutzung kann eigenständiges Denken schwächen.', 'Medium', '5 min', 'Policy', 'coral'),
  t('society-smartphones', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'People would be happier without smartphones.', 'Menschen wären ohne Smartphones glücklicher.', 'Constant access creates pressure, but phones also connect, assist and inform.', 'Ständige Erreichbarkeit erzeugt Druck, aber Handys verbinden, helfen und informieren auch.', 'Easy', '4 min', 'Everyday', 'coral'),
  t('society-algorithm', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'Platforms should explain why they recommend each post.', 'Plattformen sollten erklären, warum sie jeden Beitrag empfehlen.', 'Transparency can support agency, while explanations can become complex or performative.', 'Transparenz kann Selbstbestimmung stärken, während Erklärungen komplex oder oberflächlich werden können.', 'Hard', '6 min', 'Technology', 'coral'),
  t('society-four-day', 'Society & technology', 'Gesellschaft & Technologie', 'category-coral', 'A four-day work week should become the default.', 'Eine Vier-Tage-Woche sollte zum Standard werden.', 'Shorter weeks may improve wellbeing and focus, while some services need different coverage.', 'Kürzere Wochen könnten Wohlbefinden und Fokus verbessern, aber manche Dienste brauchen andere Abdeckung.', 'Medium', '5 min', 'Policy', 'coral'),
  t('wildcard-luck', 'Wildcard', 'Wildcard', 'category-mint', 'Being lucky matters more than working hard.', 'Glück ist wichtiger als harte Arbeit.', 'Effort shapes preparation, but timing and circumstance can decide who gets the chance.', 'Einsatz schafft Vorbereitung, aber Zeitpunkt und Umstände entscheiden oft über Chancen.', 'Easy', '4 min', 'Life', 'mint'),
  t('wildcard-nostalgia', 'Wildcard', 'Wildcard', 'category-mint', 'Nostalgia makes old entertainment seem better than it was.', 'Nostalgie lässt alte Unterhaltung besser erscheinen, als sie war.', 'Memory edits the past, but older work can also have qualities current trends lack.', 'Erinnerungen verändern die Vergangenheit, aber ältere Werke können auch besondere Qualitäten haben.', 'Easy', '4 min', 'Culture', 'mint'),
  ...extraTakes,
]

export function getTake(id: string): Take {
  return takes.find(take => take.id === id) ?? takes[0]
}

export function takeText(take: Take, language: Language): { statement: string; context: string; category: string; sourceLanguage?: Language } {
  return localizeTake(take, language)
}

export function assignSide(stance: Stance, mode: Mode, take: Take): string {
  const agrees = stance >= 1
  const supports = mode === 'sideswitch' ? !agrees : agrees
  return supports ? take.supportLabel : take.opposeLabel
}

export function movementBetween(before: Stance, after: Stance): number {
  return Math.max(-4, Math.min(4, after - before))
}

export function movementLabel(movement: number): string {
  if (movement > 0) return 'toward agree'
  if (movement < 0) return 'toward disagree'
  return 'no change'
}

const categoryAliases: Record<string, string> = {
  'gaming & internet': 'gaming',
  technology: 'ai and technology',
  'society & technology': 'ai and technology',
  films: 'movies and series',
  school: 'school and education',
  wildcard: 'wildcards',
}

function canonicalCategory(value: string): string {
  const normalized = value.trim().toLowerCase()
  return categoryAliases[normalized] || normalized
}

export function personalizeTakes(interests: string[], recentTakeIds: string[] = []): Take[] {
  const normalized = new Set(interests.map(canonicalCategory))
  const recent = new Set(recentTakeIds)
  return [...takes].sort((left, right) => {
    const leftMatch = normalized.has(canonicalCategory(left.category)) || normalized.has(canonicalCategory(left.categoryDe))
    const rightMatch = normalized.has(canonicalCategory(right.category)) || normalized.has(canonicalCategory(right.categoryDe))
    const leftRecent = recent.has(left.id)
    const rightRecent = recent.has(right.id)
    return Number(rightMatch) - Number(leftMatch) || Number(leftRecent) - Number(rightRecent) || left.id.localeCompare(right.id)
  })
}

export function selectPersonalizedTakes(interests: string[], recentTakeIds: string[] = [], limit = 3): Take[] {
  const ranked = personalizeTakes(interests, recentTakeIds)
  const selected = ranked.filter(take => !recentTakeIds.includes(take.id)).slice(0, limit)
  if (selected.length >= limit) return selected
  return [...selected, ...ranked.filter(take => !selected.some(item => item.id === take.id)).slice(0, limit - selected.length)]
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)))
}

export function calculateMockScore(responses: Record<number, string>, understanding: string, movement: number): z.infer<typeof judgeSchema> {
  const lengths = Object.values(responses).map(value => value.trim().length)
  const average = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0
  const base = bounded(52 + average / 5, 48, 88)
  const scores: ScoreBreakdown[] = [
    { label: 'Clarity', score: bounded(base / 5 + 2, 8, 20), explanation: 'Your strongest point was readable and concrete.' },
    { label: 'Relevance', score: bounded(base / 5 + 3, 8, 20), explanation: 'You stayed close to the take and the opposing points.' },
    { label: 'Reasoning', score: bounded(base / 5 + 1, 8, 20), explanation: 'Your claims had a visible chain, with room for a sharper assumption.' },
    { label: 'Rebuttal', score: bounded(base / 5 + (lengths.length > 1 ? 2 : 0), 8, 20), explanation: 'You responded to the exchange instead of repeating the opening.' },
    { label: 'Fairness', score: bounded(base / 5 + (understanding === 'yes' ? 4 : 1), 8, 20), explanation: 'You treated the other side as a position to understand, not a person to defeat.' },
  ]
  const total = bounded(scores.reduce((sum, item) => sum + item.score, 0), 0, 100)
  return judgeSchema.parse({
    total,
    confidence: 0.68,
    scores,
    strongestPoints: lengths.length ? ['You kept the exchange specific.', 'You acknowledged a real trade-off.'] : [],
    coaching: movement === 0 ? 'Try naming the evidence that would change your mind next time.' : 'Keep the same care while making your key claim one sentence sharper.',
  })
}

export function createMockOpponent(take: Take, assignedSide: string, round: number, latestArgument: string, language: Language): z.infer<typeof opponentSchema> {
  const excerpt = latestArgument.trim().replace(/\s+/g, ' ').slice(0, 100)
  if (language === 'de') {
    return opponentSchema.parse({
      response: `Du sagst „${excerpt}“. Für die Seite „${assignedSide}“ bleibt die offene Frage, ob dieser Vorteil auch dann gilt, wenn die Gegenkosten eintreten.`,
      question: round === 3 ? 'Welche Beobachtung würde dich bei diesem Punkt umstimmen?' : `Wie würdest du „${excerpt.slice(0, 60)}“ gegen das stärkste Gegenbeispiel verteidigen?`,
      round,
      language,
    })
  }
  return opponentSchema.parse({
    response: `You argue “${excerpt}”. From the side “${assignedSide}”, the open question is whether that benefit still holds when the strongest trade-off appears.`,
    question: round === 3 ? 'What observation would change your mind on this point?' : `How would you defend “${excerpt.slice(0, 60)}” against the strongest counterexample?`,
    round,
    language,
  })
}

export function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}

export function makeUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4${Math.random().toString(16).slice(2, 5)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`
}
