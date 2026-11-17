/* Genererer quiz.default.json. Kør: node tools/gen-quiz.js */
const fs = require('fs'), path = require('path');
let n = 0;
const S = (query, title, artist, year, extra) => Object.assign({ query, title, artist, album: '', cover: '', year, uri: '', startMs: 0 }, extra || {});
const STAGES = [{ ms: 1500 }, { ms: 4000 }, { ms: 8000 }, { ms: 15000 }];
const q = (type, prompt, o) => Object.assign({ id: 'q' + (++n), type, prompt }, o);

const quiz = {
  title: 'JULE FM',
  subtitle: 'Danmarks mest forkølede radiostation – sender live fra julefrokosten',
  settings: { defaultTime: 20, baseQuestionPoints: 1000, teamsEnabled: true, autoLock: true, spotifyClientId: '' },
  rounds: [
    {
      id: 'r1', emoji: '🎧', title: 'Intro-trappen', multiplier: 1,
      blurb: 'Klippet bliver længere for hvert trin – men point-potten skrumper. Tør du gætte tidligt?',
      questions: [
        q('choice', 'Hvilken sang er det?', { emoji: '🎹', options: ['Bohemian Rhapsody', 'Somebody to Love', "Don't Stop Me Now", 'Killer Queen'], correct: 0, clips: STAGES, song: S('Queen Bohemian Rhapsody', 'Bohemian Rhapsody', 'Queen', 1975), fact: 'Singlen er 5 min 55 sek. – pladeselskabet mente den var alt for lang til radioen.' }),
        q('choice', 'Hvilken sang er det?', { emoji: '👑', options: ['Waterloo', 'Dancing Queen', 'Mamma Mia', 'Fernando'], correct: 1, clips: STAGES, song: S('ABBA Dancing Queen', 'Dancing Queen', 'ABBA', 1976), fact: 'ABBA spillede den første gang for den svenske kongefamilie – ved en festaften før brylluppet i 1976.' }),
        q('choice', 'Hvilken sang er det?', { emoji: '✏️', options: ['Take On Me', 'The Sun Always Shines on TV', 'Hunting High and Low', 'Cry Wolf'], correct: 0, clips: STAGES, song: S('a-ha Take On Me', 'Take On Me', 'a-ha', 1985), fact: 'Videoen er tegnet i hånden – ca. 3.000 enkeltbilleder.' }),
        q('choice', 'Hvilken sang er det?', { emoji: '🧤', options: ['Beat It', 'Thriller', 'Billie Jean', 'Smooth Criminal'], correct: 2, clips: STAGES, song: S('Michael Jackson Billie Jean', 'Billie Jean', 'Michael Jackson', 1983), fact: 'Baslinjen er så ikonisk, at man kan genkende sangen på to toner.' }),
        q('choice', 'Hvilken sang er det?', { emoji: '💖', options: ['Roses Are Red', 'Barbie Girl', 'Dr. Jones', 'Turn Back Time'], correct: 1, clips: STAGES, song: S('Aqua Barbie Girl', 'Barbie Girl', 'Aqua', 1997), fact: 'Danskerne i Aqua blev sagsøgt af Mattel – og sagen blev afvist i USA.' })
      ]
    },
    {
      id: 'r2', emoji: '🎤', title: 'Hvem holder mikrofonen?', multiplier: 1,
      blurb: 'Skriv kunstnerens navn. Stavefejl tilgives – tomme hjerner gør ikke.',
      questions: [
        q('text', 'Hvem synger "Rolling in the Deep"?', { emoji: '🌊', correct: ['Adele'], time: 25, song: S('Adele Rolling in the Deep', 'Rolling in the Deep', 'Adele', 2010, { startMs: 28000 }) }),
        q('text', 'Hvem synger "Shape of You"?', { emoji: '🥁', correct: ['Ed Sheeran', 'Sheeran'], time: 25, song: S('Ed Sheeran Shape of You', 'Shape of You', 'Ed Sheeran', 2017) }),
        q('text', 'Hvem synger "Blinding Lights"?', { emoji: '🚗', correct: ['The Weeknd', 'Weeknd', 'Abel Tesfaye'], time: 25, song: S('The Weeknd Blinding Lights', 'Blinding Lights', 'The Weeknd', 2019) }),
        q('text', 'Hvilket dansk band har hittet med "Fascination"?', { emoji: '🇩🇰', correct: ['Alphabeat'], time: 25, song: S('Alphabeat Fascination', 'Fascination', 'Alphabeat', 2007) }),
        q('text', 'Hvem synger "7 Years" – om at blive 60 som 7-årig?', { emoji: '🎂', correct: ['Lukas Graham'], time: 25, song: S('Lukas Graham 7 Years', '7 Years', 'Lukas Graham', 2015) }),
        q('text', 'Hvem er med på "Uptown Funk"? (Ét navn er nok)', { emoji: '🕺', correct: ['Bruno Mars', 'Mark Ronson'], time: 25, song: S('Mark Ronson Uptown Funk', 'Uptown Funk', 'Mark Ronson ft. Bruno Mars', 2014) })
      ]
    },
    {
      id: 'r3', emoji: '📅', title: 'Tidsmaskinen', multiplier: 1,
      blurb: 'Gæt årstallet. Jo tættere på, jo flere point – ramt det på klingen og få det hele.',
      questions: [
        q('year', 'Hvornår udkom "Smells Like Teen Spirit"?', { emoji: '🎸', correct: 1991, yearMin: 1960, yearMax: 2025, yearTolerance: 12, time: 25, song: S('Nirvana Smells Like Teen Spirit', 'Smells Like Teen Spirit', 'Nirvana', 1991) }),
        q('year', 'Hvornår udkom "Wannabe" med Spice Girls?', { emoji: '✌️', correct: 1996, yearMin: 1960, yearMax: 2025, yearTolerance: 12, time: 25, song: S('Spice Girls Wannabe', 'Wannabe', 'Spice Girls', 1996) }),
        q('year', 'Hvornår udkom OutKasts "Hey Ya!"?', { emoji: '📸', correct: 2003, yearMin: 1960, yearMax: 2025, yearTolerance: 12, time: 25, song: S('OutKast Hey Ya', 'Hey Ya!', 'OutKast', 2003) }),
        q('year', 'Hvornår udkom "Gangnam Style"?', { emoji: '🐎', correct: 2012, yearMin: 1960, yearMax: 2025, yearTolerance: 12, time: 25, song: S('PSY Gangnam Style', 'Gangnam Style', 'PSY', 2012) }),
        q('year', 'Hvornår udkom "Despacito"?', { emoji: '🏝️', correct: 2017, yearMin: 1960, yearMax: 2025, yearTolerance: 12, time: 25, song: S('Luis Fonsi Despacito', 'Despacito', 'Luis Fonsi ft. Daddy Yankee', 2017) })
      ]
    },
    {
      id: 'r4', emoji: '🎄', title: 'Jule-twist', multiplier: 1,
      blurb: 'Klassikere, nissetosser og bagvendt julepynt. Alle spørgsmålstyper er i spil.',
      questions: [
        q('choice', 'I "Last Christmas" – hvad giver sangeren væk sidste jul?', { emoji: '❤️', options: ['Sit hjerte', 'Sin hue', 'En gave i papir', 'Sin telefon'], correct: 0, song: S('Wham Last Christmas', 'Last Christmas', 'Wham!', 1984, { startMs: 0 }), fact: 'George Michael skrev, indspillede og spillede alle instrumenter selv.' }),
        q('year', 'Hvornår udkom "All I Want for Christmas Is You"?', { emoji: '🎤', correct: 1994, yearMin: 1960, yearMax: 2025, yearTolerance: 10, time: 25, song: S('Mariah Carey All I Want for Christmas Is You', 'All I Want for Christmas Is You', 'Mariah Carey', 1994), fact: 'Mariah skrev den på cirka 15 minutter sammen med Walter Afanasieff.' }),
        q('order', 'Sortér fra ældst til nyest – tryk i rækkefølge!', { emoji: '🗓️', options: ['Mariah Carey – All I Want for Christmas Is You', 'Slade – Merry Xmas Everybody', 'Kelly Clarkson – Underneath the Tree', 'Wham! – Last Christmas'], correct: [1, 3, 0, 2], time: 30, fact: '1973 → 1984 → 1994 → 2013.' }),
        q('tf', 'Sandt eller falsk: "Do They Know It\'s Christmas?" blev indspillet af Band Aid i 1984.', { emoji: '🌍', options: ['Sandt', 'Falsk'], correct: 0, time: 15, song: S("Band Aid Do They Know It's Christmas", "Do They Know It's Christmas?", 'Band Aid', 1984), fact: 'Indspillet på én dag, 25. november 1984.' }),
        q('text', 'Hvad hedder julemandens rensdyr med den røde næse?', { emoji: '🦌', correct: ['Rudolf', 'Rudolph'], time: 15 })
      ]
    },
    {
      id: 'r5', emoji: '🔥', title: 'Musikbattle', multiplier: 1,
      blurb: 'Ingen rigtige svar – kun flertallet har ret. Medmindre vi kører omvendt…',
      questions: [
        q('vote', 'Bedste julehit?', { emoji: '🎅', options: ['Last Christmas', 'All I Want for Christmas Is You'], mode: 'majority', time: 15, points: 600 }),
        q('vote', 'Hvem skal spille til julefrokosten?', { emoji: '🎪', options: ['ABBA', 'Queen'], mode: 'majority', time: 15, points: 600 }),
        q('vote', 'OMVENDT! Hvilket årti havde den bedste musik? Det mindste hold vinder.', { emoji: '🙃', options: ["80'erne", "90'erne"], mode: 'minority', time: 15, points: 800 }),
        q('vote', 'Beatles eller Rolling Stones?', { emoji: '🎸', options: ['The Beatles', 'The Rolling Stones'], mode: 'majority', time: 15, points: 600 }),
        q('vote', 'Kim Larsen eller Shu-bi-dua?', { emoji: '🇩🇰', options: ['Kim Larsen', 'Shu-bi-dua'], mode: 'majority', time: 15, points: 600 })
      ]
    },
    {
      id: 'r6', emoji: '🎰', title: 'Lykkehjulet', multiplier: 1,
      blurb: 'Quizmasteren kan snurre hjulet inden et spørgsmål – og så er alt muligt. Dobbelt op. Tredobbelt. Kun de 5 hurtigste.',
      questions: [
        q('choice', 'Hvilket land vandt Eurovision i 2013 med "Only Teardrops"?', { emoji: '🏆', options: ['Sverige', 'Danmark', 'Norge', 'Ukraine'], correct: 1, song: S('Emmelie de Forest Only Teardrops', 'Only Teardrops', 'Emmelie de Forest', 2013), fact: 'Finalen foregik i Malmö – lige på den anden side af Øresund.' }),
        q('choice', 'Hvor mange strenge har en standardguitar?', { emoji: '🎸', options: ['4', '5', '6', '12'], correct: 2, time: 12 }),
        q('choice', 'Hvem har vundet flest Grammy Awards gennem tiden?', { emoji: '🏅', options: ['Taylor Swift', 'Beyoncé', 'Adele', 'Stevie Wonder'], correct: 1 }),
        q('choice', 'Hvilket band har Freddie Mercury, Brian May, Roger Taylor og John Deacon i?', { emoji: '👑', options: ['Queen', 'Genesis', 'Wings', 'Kiss'], correct: 0, time: 12 }),
        q('tf', 'Sandt eller falsk: "Baby Shark Dance" har over 10 milliarder visninger på YouTube.', { emoji: '🦈', options: ['Sandt', 'Falsk'], correct: 0, time: 15, fact: 'Ja. Den blev i 2022 den første YouTube-video med over 10 mia. visninger.' })
      ]
    },
    {
      id: 'r7', emoji: '👑', title: 'Finalen: Alle midler', multiplier: 2,
      blurb: 'Point tæller DOBBELT. Sats af din egen pointbeholdning på de to første – og sortér til sidst. Her kan alt vendes.',
      questions: [
        q('wager', 'SATS! Hvilken musikvideo var den første, MTV viste i 1981?', { emoji: '📺', options: ['Video Killed the Radio Star', 'Girls Just Want to Have Fun', 'Take On Me', 'Thriller'], correct: 0, time: 25, song: S('The Buggles Video Killed the Radio Star', 'Video Killed the Radio Star', 'The Buggles', 1979) }),
        q('wager', 'SATS! Hvilket album regnes for det bedst sælgende nogensinde?', { emoji: '💿', options: ['Thriller', 'Back in Black', 'The Dark Side of the Moon', 'Rumours'], correct: 0, time: 25 }),
        q('order', 'FINALE: Sortér efter udgivelsesår – ældst først!', { emoji: '🏁', options: ['Nirvana – Smells Like Teen Spirit', 'ABBA – Dancing Queen', 'Michael Jackson – Billie Jean', 'Queen – Bohemian Rhapsody'], correct: [3, 1, 2, 0], time: 35, points: 1500, fact: '1975 → 1976 → 1983 → 1991.' })
      ]
    }
  ]
};
fs.writeFileSync(path.join(__dirname, '..', 'quiz.default.json'), JSON.stringify(quiz, null, 1));
console.log('quiz.default.json: ' + quiz.rounds.length + ' runder, ' + n + ' spørgsmål');
