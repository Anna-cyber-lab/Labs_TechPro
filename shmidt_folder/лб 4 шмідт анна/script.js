// зберігаю елементи
const input = document.getElementById('nameInput'),
      list = document.getElementById('studentsList'),
      timer = document.getElementById('timerDisplay');

// мій робочий масив
let students = [];

// оновлюю вигляд списку (DOM)
const renderList = () => {
    list.innerHTML = '';
    
    // рахую повтори для підсвічування
    const counts = students.reduce((acc, name) => {
        const lower = name.toLowerCase();
        acc[lower] = (acc[lower] || 0) + 1;
        return acc;
    }, {});

    // створюю елементи <li>
    students.forEach(name => {
        const item = document.createElement('li');
        item.textContent = name;
        // підсвічую повтори
        if (counts[name.toLowerCase()] > 1) item.classList.add('duplicate');
        list.appendChild(item);
    });
};

// додаю нове ім'я
function addStudent() {
    const name = input.value.trim();
    if (!name) return; // якщо пусто, виходжу
    
    students.push(name);
    renderList();
    input.value = '';
    input.focus();
}

// сортую і виміряю час
function sortAndHighlight() {
    // вмикаю точний таймер
    const start = window.performance.now(); 

    // сортую українською
    students.sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }));

    const end = window.performance.now(); 
    
    renderList(); 
    
    // показую час сортування
    const time = (end - start).toFixed(3);
    timer.textContent = `Час: ${time} мс`;
}