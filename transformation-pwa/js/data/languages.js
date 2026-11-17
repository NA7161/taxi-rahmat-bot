// Контент уроков. Ключ языка -> описание. Для нового языка добавьте запись со status:'ready' и lessons.
// Слово: w(фраза_на_изучаемом, перевод_на_русский, транскрипция_русскими_буквами?)
// Упражнения:
//  {t:'choice', en:'X'}  -> выбрать перевод из 4 (ключ = слово урока); {t:'choice', ru:'Y'} -> выбрать слово из 4
//  {t:'type', prompt, answers:[..]} -> ввод с клавиатуры (регистр и знаки препинания не важны)
//  {t:'build', prompt, answer, extra:[..]} -> составить фразу из слов (extra — лишние слова)
//  {t:'listen', say:'X'} -> прослушать (speechSynthesis) и выбрать, что услышали; скрывается, если озвучки нет
const w = (en, ru, tr) => (tr ? { en, ru, tr } : { en, ru });
const ch = en => ({ t: 'choice', en });
const chr = ru => ({ t: 'choice', ru });
const ty = (prompt, ...answers) => ({ t: 'type', prompt, answers });
const bd = (prompt, answer, ...extra) => ({ t: 'build', prompt, answer, extra });
const ls = say => ({ t: 'listen', say });

export const PASS_SCORE = 0.6; // порог прохождения урока
export const XP_FIRST = 15; // разовый бонус за первое прохождение
export const DEFAULT_LANG = 'en';

const EN_LESSONS = [
  {
    id: 'en-1', title: 'Приветствия', icon: '👋',
    words: [
      w('Hello', 'Здравствуйте', 'хэлоу'), w('Hi', 'Привет', 'хай'), w('Good morning', 'Доброе утро', 'гуд монинг'),
      w('Good evening', 'Добрый вечер', 'гуд ивнинг'), w('Good night', 'Спокойной ночи', 'гуд найт'),
      w('Goodbye', 'До свидания', 'гудбай'), w('Please', 'Пожалуйста', 'плиз'), w('Thank you', 'Спасибо', 'сэнк ю'),
      w('Sorry', 'Извините', 'сорри'), w('Yes', 'Да', 'йес'), w('No', 'Нет', 'ноу'), w('How are you?', 'Как дела?', 'хау а ю'),
    ],
    exercises: [
      ch('Thank you'), chr('Спокойной ночи'), ty('Как по-английски «Доброе утро»?', 'good morning'),
      bd('Доброе утро, как дела?', 'Good morning, how are you?'), ls('Good evening'),
    ],
  },
  {
    id: 'en-2', title: 'Числа 0–10', icon: '🔢',
    words: [
      w('zero', 'ноль', 'зиро'), w('one', 'один', 'уан'), w('two', 'два', 'ту'), w('three', 'три', 'сри'), w('four', 'четыре', 'фо'),
      w('five', 'пять', 'файв'), w('six', 'шесть', 'сикс'), w('seven', 'семь', 'сэвн'), w('eight', 'восемь', 'эйт'),
      w('nine', 'девять', 'найн'), w('ten', 'десять', 'тэн'),
    ],
    exercises: [
      ch('seven'), chr('восемь'), ty('Напишите словом: 5', 'five'), ty('Как по-английски «десять»?', 'ten'),
      bd('Два плюс два будет четыре', 'Two plus two is four'), ls('nine'),
    ],
  },
  {
    id: 'en-3', title: 'Семья', icon: '👨‍👩‍👧',
    words: [
      w('mother', 'мать (мама)', 'мазэ'), w('father', 'отец', 'фазэ'), w('sister', 'сестра', 'систэ'), w('brother', 'брат', 'бразэ'),
      w('grandmother', 'бабушка'), w('grandfather', 'дедушка'), w('son', 'сын', 'сан'), w('daughter', 'дочь', 'дотэ'),
      w('husband', 'муж'), w('wife', 'жена', 'уайф'), w('parents', 'родители'), w('family', 'семья', 'фэмили'),
    ],
    exercises: [
      ch('sister'), chr('дедушка'), ty('Как по-английски «семья»?', 'family'),
      bd('Это моя мать', 'This is my mother', 'father', 'your'), bd('У меня есть брат', 'I have a brother', 'sister', 'has'), ls('brother'),
    ],
  },
  {
    id: 'en-4', title: 'Еда и напитки', icon: '🍎',
    words: [
      w('bread', 'хлеб', 'бред'), w('water', 'вода', 'уотэ'), w('milk', 'молоко', 'милк'), w('tea', 'чай', 'ти'), w('coffee', 'кофе', 'кофи'),
      w('apple', 'яблоко', 'эпл'), w('meat', 'мясо', 'мит'), w('fish', 'рыба', 'фиш'), w('rice', 'рис', 'райс'), w('egg', 'яйцо', 'эг'),
      w('soup', 'суп', 'суп'), w('cheese', 'сыр', 'чиз'),
    ],
    exercises: [
      ch('cheese'), chr('рыба'), ty('Как по-английски «молоко»?', 'milk'),
      bd('Я люблю чай', 'I like tea', 'water', 'want'), bd('Я пью кофе', 'I drink coffee', 'tea', 'eat'), ls('bread'),
    ],
  },
  {
    id: 'en-5', title: 'Дни недели и время', icon: '📅',
    words: [
      w('Monday', 'понедельник'), w('Tuesday', 'вторник'), w('Wednesday', 'среда'), w('Thursday', 'четверг'), w('Friday', 'пятница'),
      w('Saturday', 'суббота'), w('Sunday', 'воскресенье'), w('today', 'сегодня', 'тудэй'), w('tomorrow', 'завтра', 'тумороу'),
      w('yesterday', 'вчера', 'йестэдэй'), w('week', 'неделя', 'уик'), w('day', 'день', 'дэй'),
    ],
    exercises: [
      ch('Friday'), chr('вторник'), ty('Как по-английски «завтра»?', 'tomorrow'), ty('Как по-английски «неделя»?', 'week'),
      bd('Увидимся завтра', 'See you tomorrow', 'today', 'yesterday'), ls('Wednesday'),
    ],
  },
  {
    id: 'en-6', title: 'Глагол to be', icon: '🧩',
    words: [
      w('I am a student', 'Я студент'), w('You are a teacher', 'Ты учитель'), w('He is a doctor', 'Он врач'),
      w('She is happy', 'Она счастлива'), w('It is a cat', 'Это кошка'), w('We are friends', 'Мы друзья'),
      w('They are at home', 'Они дома'), w('I am not tired', 'Я не устал'), w('Are you ready?', 'Ты готов?'),
      w('Where are you?', 'Где ты?'), w('I am from Russia', 'Я из России'), w('He is my brother', 'Он мой брат'),
    ],
    exercises: [
      ch('We are friends'), chr('Я студент'), ty('Переведите: «Он врач»', 'he is a doctor', "he's a doctor"),
      bd('Они дома', 'They are at home', 'is', 'am'), bd('Я не устал', 'I am not tired', 'is'), ls('Where are you?'),
    ],
  },
  {
    id: 'en-7', title: 'Глагол to have', icon: '🎒',
    words: [
      w('I have a book', 'У меня есть книга'), w('You have a car', 'У тебя есть машина'), w('He has a dog', 'У него есть собака'),
      w('She has a sister', 'У неё есть сестра'), w('We have a house', 'У нас есть дом'), w('They have two children', 'У них двое детей'),
      w('I do not have time', 'У меня нет времени'), w('Do you have a pen?', 'У тебя есть ручка?'),
      w('She has two brothers', 'У неё два брата'), w('He does not have a phone', 'У него нет телефона'),
      w('I have a question', 'У меня есть вопрос'), w('Have a nice day', 'Хорошего дня'),
    ],
    exercises: [
      ch('He has a dog'), chr('У нас есть дом'), ty('Переведите: «У меня есть вопрос»', 'i have a question'),
      bd('У неё есть сестра', 'She has a sister', 'have'), bd('У тебя есть ручка?', 'Do you have a pen', 'has', 'does'), ls('I have a book'),
    ],
  },
  {
    id: 'en-8', title: 'Цвета', icon: '🎨',
    words: [
      w('red', 'красный', 'рэд'), w('blue', 'синий', 'блу'), w('green', 'зелёный', 'грин'), w('yellow', 'жёлтый', 'йэлоу'),
      w('black', 'чёрный', 'блэк'), w('white', 'белый', 'уайт'), w('orange', 'оранжевый'), w('brown', 'коричневый', 'браун'),
      w('grey', 'серый', 'грэй'), w('pink', 'розовый', 'пинк'), w('purple', 'фиолетовый'),
    ],
    exercises: [
      ch('green'), chr('белый'), ty('Как по-английски «красный»?', 'red'),
      bd('Яблоко красное', 'The apple is red', 'green', 'are'), ls('yellow'), ch('purple'),
    ],
  },
  {
    id: 'en-9', title: 'Местоимения и имя', icon: '🙋',
    words: [
      w('I', 'я', 'ай'), w('you', 'ты / вы', 'ю'), w('he', 'он', 'хи'), w('she', 'она', 'ши'), w('it', 'оно / это', 'ит'),
      w('we', 'мы', 'уи'), w('they', 'они', 'дэй'), w('my', 'мой', 'май'), w('your', 'твой / ваш'),
      w('this', 'этот'), w('that', 'тот'), w('name', 'имя', 'нэйм'),
    ],
    exercises: [
      ch('we'), chr('они'), ty('Как по-английски «имя»?', 'name'),
      bd('Меня зовут Анна', 'My name is Anna', 'your', 'am'), bd('Как тебя зовут?', 'What is your name', 'my', 'are'), ls('they'),
    ],
  },
  {
    id: 'en-10', title: 'Дом и город', icon: '🏠',
    words: [
      w('house', 'дом', 'хаус'), w('room', 'комната', 'рум'), w('kitchen', 'кухня', 'китчен'), w('door', 'дверь', 'до'),
      w('window', 'окно', 'уиндоу'), w('table', 'стол', 'тэйбл'), w('chair', 'стул', 'чэа'), w('bed', 'кровать', 'бэд'),
      w('school', 'школа', 'скул'), w('city', 'город', 'сити'), w('street', 'улица', 'стрит'), w('book', 'книга', 'бук'),
    ],
    exercises: [
      ch('window'), chr('кухня'), ty('Как по-английски «стол»?', 'table'),
      bd('Книга на столе', 'The book is on the table', 'chair', 'in'), ls('street'), chr('город'),
    ],
  },
  {
    id: 'en-11', title: 'Основные глаголы', icon: '🏃',
    words: [
      w('to eat', 'есть (кушать)'), w('to drink', 'пить'), w('to go', 'идти / ехать'), w('to read', 'читать'), w('to write', 'писать'),
      w('to sleep', 'спать'), w('to work', 'работать'), w('to speak', 'говорить'), w('to see', 'видеть'),
      w('to want', 'хотеть'), w('to like', 'любить / нравиться'), w('to live', 'жить'),
    ],
    exercises: [
      ch('to sleep'), chr('читать'), ty('Как по-английски «работать»?', 'to work', 'work'),
      bd('Я хочу спать', 'I want to sleep', 'eat', 'like'), bd('Я живу в Москве', 'I live in Moscow', 'work'), ls('to read'),
    ],
  },
  {
    id: 'en-12', title: 'Вопросы', icon: '❓',
    words: [
      w('What', 'что', 'уот'), w('Who', 'кто', 'ху'), w('Where', 'где', 'уэа'), w('When', 'когда', 'уэн'), w('Why', 'почему', 'уай'),
      w('How', 'как', 'хау'), w('Which', 'какой (из)'), w('How many', 'сколько (о счётном)'), w('How much', 'сколько (о несчётном)'),
      w('What is your name?', 'Как тебя зовут?'), w('Where are you from?', 'Откуда ты?'), w('How old are you?', 'Сколько тебе лет?'),
    ],
    exercises: [
      ch('Why'), chr('кто'), ty('Как по-английски «почему»?', 'why'),
      bd('Сколько тебе лет?', 'How old are you', 'what', 'is'), ls('Where are you from?'), chr('где'),
    ],
  },
];

export const LANGUAGES = {
  en: { id: 'en', name: 'Английский', flag: '🇬🇧', speech: 'en-US', level: 'A1', status: 'ready', lessons: EN_LESSONS },
  // Заготовки: контента пока нет.
  tg: { id: 'tg', name: 'Таджикский', flag: '🇹🇯', speech: null, level: 'A1', status: 'soon', lessons: [] },
  ru: { id: 'ru', name: 'Русский (как иностранный)', flag: '🇷🇺', speech: 'ru-RU', level: 'A1', status: 'soon', lessons: [] },
};
