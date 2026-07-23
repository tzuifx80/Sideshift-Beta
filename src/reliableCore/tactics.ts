import type { Language } from '../domain'

export const TACTIC_IDS = [
  'challenge-assumption',
  'request-evidence',
  'counterexample',
  'alternative-cause',
  'trade-off',
  'unintended-consequence',
  'principle-conflict',
  'feasibility',
  'acknowledge-and-rebut',
  'scope-exception',
  'compare-alternatives',
  'closing-challenge',
] as const

export type TacticId = (typeof TACTIC_IDS)[number]

type TacticTemplate = {
  body: string
  challenge: string
}

type LocalizedTactic = Record<Language, TacticTemplate>

/** Localized composition structures — no fabricated facts or statistics. */
export const tacticLibrary: Record<TacticId, LocalizedTactic> = {
  'challenge-assumption': {
    en: { body: 'Your case leans on an assumption about "{motion}" that may not hold in every situation.', challenge: 'What would change your mind if that assumption failed?' },
    de: { body: 'Dein Argument stützt sich auf eine Annahme zu „{motion}“, die nicht in jeder Situation gilt.', challenge: 'Was würde deine Position ändern, wenn diese Annahme nicht träfe?' },
    fr: { body: 'Votre argument repose sur une hypothèse concernant « {motion} » qui ne tient pas dans tous les cas.', challenge: 'Qu’est-ce qui changerait votre avis si cette hypothèse échouait ?' },
    es: { body: 'Tu caso se apoya en una suposición sobre «{motion}» que quizá no se cumpla siempre.', challenge: '¿Qué cambiaría tu postura si esa suposición fallara?' },
    it: { body: 'Il tuo argomento si basa su un presupposto su «{motion}» che forse non vale sempre.', challenge: 'Cosa cambierebbe la tua posizione se quel presupposto non reggesse?' },
  },
  'request-evidence': {
    en: { body: 'You state a position on "{motion}", but the link between your claim and its support is not yet clear.', challenge: 'Which observable evidence would back this up in practice?' },
    de: { body: 'Du nennst eine Position zu „{motion}“, aber der Zusammenhang zwischen Behauptung und Beleg ist noch offen.', challenge: 'Welche beobachtbare Evidenz würde das in der Praxis stützen?' },
    fr: { body: 'Vous défendez une position sur « {motion} », mais le lien entre l’affirmation et son appui reste flou.', challenge: 'Quelle preuve observable soutiendrait cela concrètement ?' },
    es: { body: 'Defiendes una postura sobre «{motion}», pero aún no queda claro cómo se conecta con su apoyo.', challenge: '¿Qué evidencia observable lo respaldaría en la práctica?' },
    it: { body: 'Difendi una posizione su «{motion}», ma il legame tra affermazione e supporto non è ancora chiaro.', challenge: 'Quale evidenza osservabile lo sosterrebbe nella pratica?' },
  },
  'counterexample': {
    en: { body: 'There are plausible cases where the approach behind "{motion}" would produce a different outcome than you expect.', challenge: 'How would your rule handle a clear counterexample?' },
    de: { body: 'Es gibt plausible Fälle, in denen der Ansatz hinter „{motion}“ anders ausfiele als erwartet.', challenge: 'Wie würde deine Regel mit einem klaren Gegenbeispiel umgehen?' },
    fr: { body: 'Des cas plausibles montrent que l’approche derrière « {motion} » pourrait produire un autre résultat.', challenge: 'Comment votre règle traiterait-elle un contre-exemple clair ?' },
    es: { body: 'Hay casos plausibles en los que el enfoque detrás de «{motion}» daría otro resultado del esperado.', challenge: '¿Cómo manejaría tu regla un contraejemplo claro?' },
    it: { body: 'Ci sono casi plausibili in cui l’approccio dietro «{motion}» produrrebbe un esito diverso.', challenge: 'Come gestirebbe la tua regola un controesempio chiaro?' },
  },
  'alternative-cause': {
    en: { body: 'The trend you describe around "{motion}" might also be explained by another factor you have not weighed yet.', challenge: 'What alternative cause would you need to rule out?' },
    de: { body: 'Der Trend, den du bei „{motion}“ beschreibst, ließe sich auch durch einen anderen, noch nicht geprüften Faktor erklären.', challenge: 'Welche alternative Ursache müsstest du ausschließen?' },
    fr: { body: 'La tendance que vous décrivez autour de « {motion} » pourrait aussi venir d’un autre facteur non examiné.', challenge: 'Quelle cause alternative faudrait-il écarter ?' },
    es: { body: 'La tendencia que describes sobre «{motion}» podría explicarse también por otro factor no considerado.', challenge: '¿Qué causa alternativa tendrías que descartar?' },
    it: { body: 'La tendenza che descrivi su «{motion}» potrebbe dipendere anche da un altro fattore non valutato.', challenge: 'Quale causa alternativa dovresti escludere?' },
  },
  'trade-off': {
    en: { body: 'Supporting "{motion}" may secure one benefit while accepting a cost elsewhere that deserves attention.', challenge: 'Which trade-off are you willing to defend openly?' },
    de: { body: '„{motion}“ zu unterstützen kann einen Nutzen sichern und zugleich Kosten an anderer Stelle verursachen.', challenge: 'Welchen Trade-off würdest du offen verteidigen?' },
    fr: { body: 'Soutenir « {motion} » peut apporter un avantage tout en imposant un coût ailleurs.', challenge: 'Quel compromis seriez-vous prêt à assumer ouvertement ?' },
    es: { body: 'Apoyar «{motion}» puede asegurar un beneficio mientras aceptas un coste en otro lugar.', challenge: '¿Qué compensación defenderías abiertamente?' },
    it: { body: 'Sostenere «{motion}» può garantire un beneficio accettando un costo altrove.', challenge: 'Quale compromesso difenderesti apertamente?' },
  },
  'unintended-consequence': {
    en: { body: 'A policy aligned with "{motion}" could create incentives that push people toward the opposite behavior.', challenge: 'What unintended consequence would you monitor first?' },
    de: { body: 'Eine Politik im Sinne von „{motion}“ könnte Anreize schaffen, die das Gegenteil begünstigen.', challenge: 'Welche unbeabsichtigte Folge würdest du zuerst beobachten?' },
    fr: { body: 'Une politique alignée sur « {motion} » pourrait créer des incitations contraires à l’objectif visé.', challenge: 'Quelle conséquence imprévue surveilleriez-vous en premier ?' },
    es: { body: 'Una política alineada con «{motion}» podría crear incentivos hacia el comportamiento opuesto.', challenge: '¿Qué consecuencia no deseada vigilarías primero?' },
    it: { body: 'Una politica allineata a «{motion}» potrebbe creare incentivi verso il comportamento opposto.', challenge: 'Quale conseguenza indesiderata monitoreresti per prima?' },
  },
  'principle-conflict': {
    en: { body: 'Your side of "{motion}" may collide with another value people care about when cases get harder.', challenge: 'Which principle wins when two values conflict?' },
    de: { body: 'Deine Seite bei „{motion}“ kann mit einem anderen wichtigen Wert kollidieren, wenn Fälle schwieriger werden.', challenge: 'Welches Prinzip gewinnt bei einem Wertekonflikt?' },
    fr: { body: 'Votre position sur « {motion} » peut entrer en tension avec une autre valeur importante dans les cas difficiles.', challenge: 'Quel principe l’emporte quand deux valeurs s’opposent ?' },
    es: { body: 'Tu lado de «{motion}» puede chocar con otro valor importante cuando los casos se complican.', challenge: '¿Qué principio prevalece cuando dos valores entran en conflicto?' },
    it: { body: 'La tua posizione su «{motion}» può scontrarsi con un altro valore quando i casi diventano difficili.', challenge: 'Quale principio prevale quando due valori sono in conflitto?' },
  },
  'feasibility': {
    en: { body: 'Even if "{motion}" is attractive in theory, carrying it out depends on constraints you have not addressed.', challenge: 'What makes this workable in real institutions or daily life?' },
    de: { body: 'Selbst wenn „{motion}“ theoretisch überzeugt, hängt die Umsetzung von noch offenen Rahmenbedingungen ab.', challenge: 'Was macht das in echten Institutionen oder im Alltag praktikabel?' },
    fr: { body: 'Même si « {motion} » paraît séduisant en théorie, sa mise en œuvre dépend de contraintes non abordées.', challenge: 'Qu’est-ce qui le rend applicable dans la vie réelle ?' },
    es: { body: 'Aunque «{motion}» resulte atractivo en teoría, aplicarlo depende de límites que aún no abordas.', challenge: '¿Qué lo haría viable en instituciones o en la vida diaria?' },
    it: { body: 'Anche se «{motion}» è attraente in teoria, attuarlo dipende da vincoli non ancora affrontati.', challenge: 'Cosa lo renderebbe praticabile nella vita reale?' },
  },
  'acknowledge-and-rebut': {
    en: { body: 'You raise a fair point about "{motion}", yet it still leaves room for a different conclusion on my side.', challenge: 'Why should your reading outweigh the counter-pressure I describe?' },
    de: { body: 'Du machst einen fairen Punkt zu „{motion}“, aber daraus folgt noch nicht zwingend deine Schlussfolgerung.', challenge: 'Warum sollte deine Lesart das Gegenargument überwiegen?' },
    fr: { body: 'Vous soulevez un point juste sur « {motion} », mais une autre conclusion reste possible de mon côté.', challenge: 'Pourquoi votre lecture devrait-elle l’emporter sur la contre-pression que je décris ?' },
    es: { body: 'Plantas un punto justo sobre «{motion}», pero aún cabe otra conclusión desde mi lado.', challenge: '¿Por qué tu lectura debería pesar más que la presión contraria que describo?' },
    it: { body: 'Sollevi un punto giusto su «{motion}», ma dalla mia parte resta spazio per un’altra conclusione.', challenge: 'Perché la tua lettura dovrebbe prevalere sulla controspinta che descrivo?' },
  },
  'scope-exception': {
    en: { body: 'Your argument about "{motion}" may hold in some contexts but not across every scope you imply.', challenge: 'Where should your claim stop applying?' },
    de: { body: 'Dein Argument zu „{motion}“ mag in manchen Kontexten gelten, aber nicht in jedem Bereich, den du andeutest.', challenge: 'Wo sollte deine Behauptung ihre Grenze haben?' },
    fr: { body: 'Votre argument sur « {motion} » peut tenir dans certains contextes, mais pas partout où vous l’étendez.', challenge: 'Où votre affirmation devrait-elle cesser de s’appliquer ?' },
    es: { body: 'Tu argumento sobre «{motion}» puede valer en algunos contextos, pero no en todo el alcance que sugieres.', challenge: '¿Dónde debería dejar de aplicarse tu afirmación?' },
    it: { body: 'Il tuo argomento su «{motion}» può valere in alcuni contesti, ma non in tutto l’ambito che implici.', challenge: 'Dove dovrebbe smettere di applicarsi la tua affermazione?' },
  },
  'compare-alternatives': {
    en: { body: 'There are other ways to frame "{motion}" that may achieve similar goals with fewer downsides.', challenge: 'Why is your option better than the main alternative?' },
    de: { body: 'Es gibt andere Wege, „{motion}“ zu denken, die ähnliche Ziele mit weniger Nachteilen erreichen könnten.', challenge: 'Warum ist deine Option besser als die wichtigste Alternative?' },
    fr: { body: 'D’autres façons d’aborder « {motion} » pourraient atteindre des objectifs proches avec moins d’inconvénients.', challenge: 'Pourquoi votre option vaut-elle mieux que l’alternative principale ?' },
    es: { body: 'Hay otras formas de plantear «{motion}» que podrían lograr metas parecidas con menos costes.', challenge: '¿Por qué tu opción es mejor que la alternativa principal?' },
    it: { body: 'Ci sono altri modi di inquadrare «{motion}» che potrebbero raggiungere obiettivi simili con meno svantaggi.', challenge: 'Perché la tua opzione è migliore dell’alternativa principale?' },
  },
  'closing-challenge': {
    en: { body: 'As we close on "{motion}", the decisive question is whether your case survives the strongest pressure from the other side.', challenge: 'In one sentence: what is the hinge your entire case rests on?' },
    de: { body: 'Zum Abschluss bei „{motion}“ entscheidet, ob dein Fall dem stärksten Gegendruck standhält.', challenge: 'In einem Satz: Worauf stützt sich dein gesamter Fall?' },
    fr: { body: 'Pour conclure sur « {motion} », la question décisive est de savoir si votre cas résiste à la pression opposée.', challenge: 'En une phrase : sur quel pivot repose tout votre argument ?' },
    es: { body: 'Al cerrar «{motion}», la pregunta decisiva es si tu caso resiste la mayor presión del otro lado.', challenge: 'En una frase: ¿cuál es la bisagra de todo tu argumento?' },
    it: { body: 'Chiudendo su «{motion}», la domanda decisiva è se il tuo caso regge la pressione più forte dell’altro lato.', challenge: 'In una frase: qual è la cerniera su cui poggia tutto il tuo caso?' },
  },
}

export function tacticForSignals(signals: {
  hasEvidenceMarker: boolean
  hasUnsupportedCertainty: boolean
  hasAbsolutistLanguage: boolean
  hasCausalLanguage: boolean
  hasComparison: boolean
  hasConcession: boolean
  isQuestion: boolean
  isRepeated: boolean
  relevanceScore: number
}, round: number, roundLimit: number): TacticId[] {
  const ranked: TacticId[] = []
  if (signals.hasUnsupportedCertainty || signals.hasAbsolutistLanguage) ranked.push('challenge-assumption', 'request-evidence')
  if (signals.hasEvidenceMarker) ranked.push('counterexample', 'alternative-cause')
  if (signals.hasCausalLanguage) ranked.push('alternative-cause', 'unintended-consequence')
  if (signals.hasComparison) ranked.push('compare-alternatives', 'trade-off')
  if (signals.hasConcession) ranked.push('acknowledge-and-rebut')
  if (signals.relevanceScore < 0.25) ranked.push('scope-exception', 'principle-conflict')
  if (signals.isRepeated) ranked.push('closing-challenge', 'request-evidence')
  if (signals.isQuestion) ranked.push('acknowledge-and-rebut', 'feasibility')
  ranked.push('trade-off', 'feasibility', 'principle-conflict', 'unintended-consequence', 'scope-exception', 'compare-alternatives', 'counterexample', 'request-evidence', 'challenge-assumption')
  if (round >= roundLimit) ranked.unshift('closing-challenge')
  return ranked
}
