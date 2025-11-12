// ====================================================================
// ГЛОБАЛЬНІ ЗМІННІ ТА ЕЛЕМЕНТИ DOM
// ====================================================================

let courses = [];
const STORAGE_KEY = 'coursesData';
let currentSort = 'title'; // Сортування за назвою за замовчуванням

// --- Елементи форми курсу ---
const courseForm = document.getElementById('courseForm');
const courseIdInput = document.getElementById('courseId');
const courseTitleInput = document.getElementById('courseTitle');
const totalHoursInput = document.getElementById('totalHours');
const hoursDoneInput = document.getElementById('hoursDone');
const submitCourseBtn = document.getElementById('submitCourseBtn');

// --- Елементи трекінгу ---
const trackerForm = document.getElementById('trackerForm');
const trackerCourseSelect = document.getElementById('trackerCourseSelect');
const studyDateInput = document.getElementById('studyDate');
const hoursTrackedInput = document.getElementById('hoursTracked');

// --- Елементи керування даними ---
const coursesTableBody = document.getElementById('coursesTableBody');
const sortSelect = document.getElementById('sortSelect');
const filterSelect = document.getElementById('filterSelect');
const searchQueryInput = document.getElementById('searchQuery');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFile');

// ====================================================================
// УТИЛІТАРНІ ФУНКЦІЇ
// ====================================================================

/** Отримує поточну дату у форматі YYYY-MM-DD. */
const getTodayDateString = () => new Date().toISOString().split('T')[0];

/** Парсить дату з рядка YYYY-MM-DD. */
const parseDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return isNaN(date.getTime()) ? null : date;
};

// ====================================================================
// ВАЛІДАЦІЯ ТА ОБРОБКА ПОМИЛОК
// ====================================================================

/** Відображає або приховує повідомлення про помилки. */
const displayError = (elementId, message) => {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = message ? 'block' : 'none';
    }
};

/** Валідує форму додавання/редагування курсу. */
const validateCourseForm = (title, totalHours, hoursDone) => {
    displayError('titleError', '');
    displayError('hoursError', '');

    // 1. Назва курсу
    if (!title.trim() || title.length > 50) {
        displayError('titleError', 'Назва курсу є обов\'язковою (до 50 символів).');
        return false;
    }

    // 2. Обсяг (ціле число, min:1, max:1000)
    if (isNaN(totalHours) || totalHours < 1 || totalHours > 1000 || totalHours !== Math.floor(totalHours)) {
        displayError('hoursError', 'Обсяг має бути цілим числом від 1 до 1000.');
        return false;
    }

    // 3. Відпрацьовано (не менше 0, не більше Обсягу)
    if (isNaN(hoursDone) || hoursDone < 0 || hoursDone > totalHours) {
        hoursDone > totalHours && displayError('hoursError', 'Відпрацьовано годин не може перевищувати Загальний обсяг.');
        return false;
    }

    return true;
};

// ====================================================================
// ЗБЕРЕЖЕННЯ ТА ЗАВАНТАЖЕННЯ ДАНИХ
// ====================================================================

/** Зберігає курси у localStorage. */
const saveToLocalStorage = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch (e) {
        console.error('Помилка збереження у localStorage', e);
    }
};

/** Завантажує курси з localStorage. */
const loadFromLocalStorage = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;

        courses = JSON.parse(data).map(course => {
            const { id, name, totalHours, currentProgress = 0, progressHistory = [] } = course;
            return { id, name, totalHours, currentProgress, progressHistory, averageDailyRate: 0, estimatedEndDate: '---' };
        });
        courses.forEach(calculateEstimatedEndDate);
    } catch (e) {
        console.error('Помилка завантаження з localStorage', e);
    }
};

// ====================================================================
// ЛОГІКА РОЗРАХУНКУ ТА СТАТИСТИКИ
// ====================================================================

/** Обчислення очікуваної дати завершення. */
const calculateEstimatedEndDate = (course) => {
    const remainingHours = course.totalHours - course.currentProgress;

    if (remainingHours <= 0) {
        course.averageDailyRate = 0;
        course.estimatedEndDate = 'Завершено';
        return;
    }

    const today = parseDate(getTodayDateString());
    if (!today) { course.estimatedEndDate = '---'; return; }

    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
   
    const recentProgress = course.progressHistory.filter(r => {
        const recordDate = parseDate(r.date);
        return recordDate >= sevenDaysAgo && recordDate <= today;
    });

    const totalHoursLast7Days = recentProgress.reduce((sum, r) => sum + r.hours, 0);
    const studyDays = new Set(recentProgress.map(r => r.date)).size || 1;

    const avgDailyRate = totalHoursLast7Days / studyDays;
    const dailyRate = avgDailyRate > 0 ? avgDailyRate : 2; // Фіксована ставка 2 год
    course.averageDailyRate = dailyRate;
   
    const daysToFinish = Math.ceil(remainingHours / dailyRate);
    const endDate = new Date(today.getTime() + daysToFinish * 24 * 60 * 60 * 1000);

    course.estimatedEndDate = endDate.toISOString().split('T')[0];
};

/** Оновлює панель статистики. */
const updateStatistics = () => {
    const totalCourses = courses.length;
    const totalHours = courses.reduce((sum, c) => sum + c.totalHours, 0);
    const totalProgress = courses.reduce((sum, c) => sum + c.currentProgress, 0);
    const averageProgress = totalHours > 0 ? ((totalProgress / totalHours) * 100).toFixed(1) : '0';

    const biggestDebtCourse = courses
        .filter(c => c.currentProgress < c.totalHours)
        .reduce((debt, c) => {
            const remaining = c.totalHours - c.currentProgress;
            return remaining > debt.maxRemaining ? { name: c.name, maxRemaining: remaining } : debt;
        }, { name: '--', maxRemaining: -1 }).name;

    document.getElementById('totalCourses').textContent = totalCourses.toString();
    document.getElementById('totalHoursSum').textContent = `${totalHours.toFixed(1)} год`;
    document.getElementById('averageProgress').textContent = `${averageProgress}%`;
    document.getElementById('biggestDebt').textContent = biggestDebtCourse;
};

// ====================================================================
// СОРТУВАННЯ ТА ФІЛЬТРАЦІЯ
// ====================================================================

/** Сортує курси за критерієм. */
const sortCourses = (data) => data.sort((a, b) => {
    const remainingA = a.totalHours - a.currentProgress;
    const remainingB = b.totalHours - b.currentProgress;
    const progressA = a.currentProgress / a.totalHours;
    const progressB = b.currentProgress / b.totalHours;

    switch (currentSort) {
        case 'title': return a.name.localeCompare(b.name);
        case 'progress_desc': return progressB - progressA;
        case 'hoursLeft_asc': return remainingA - remainingB;
        default: return 0;
    }
});

/** Застосовує фільтри, пошук та сортування, оновлюючи таблицю. */
const applyFiltersAndSort = () => {
    const filterValue = filterSelect.value;
    const searchValue = searchQueryInput.value.toLowerCase();
   
    const filtered = courses.filter(c => 
        c.name.toLowerCase().includes(searchValue) &&
        (filterValue === 'all' || 
          (filterValue === 'completed' ? c.currentProgress >= c.totalHours : c.currentProgress < c.totalHours))
    );

    renderTable(sortCourses(filtered));
};

// ====================================================================
// ВІДОБРАЖЕННЯ ТА ОНОВЛЕННЯ DOM
// ====================================================================

/** Оновлює випадаючий список для трекінгу. */
const updateTrackingSelect = () => {
    if (!trackerCourseSelect) return;

    const selectedValue = trackerCourseSelect.value;
    trackerCourseSelect.innerHTML = '<option value="" disabled selected>Виберіть курс</option>' + 
        courses.map(c => `<option value="${c.id}"${c.id === selectedValue ? ' selected' : ''}>${c.name}</option>`).join('');

    !selectedValue || !courses.some(c => c.id === selectedValue) && (trackerCourseSelect.value = "");
};

/** Візуалізація таблиці курсів. */
const renderTable = (data) => {
    if (!coursesTableBody) return;

    coursesTableBody.innerHTML = data.length === 0
        ? '<tr><td colspan="6" style="text-align: center;">Курсів не знайдено.</td></tr>'
        : data.map(course => {
            const progressPercent = (course.totalHours > 0 ? Math.min(100, (course.currentProgress / course.totalHours) * 100) : 0).toFixed(1);
            const remainingHours = Math.max(0, course.totalHours - course.currentProgress).toFixed(1);
            
            return `
                <tr data-course-id="${course.id}">
                    <td>${course.name}</td>
                    <td>${course.totalHours}</td>
                    <td>${progressPercent}%</td>
                    <td>${remainingHours}</td>
                    <td>${course.estimatedEndDate}</td>
                    <td class="action-buttons">
                        <button class="table-action-btn edit-btn" onclick="loadCourseForEditing('${course.id}')">Редагувати</button>
                        <button class="table-action-btn delete-btn" onclick="deleteCourse('${course.id}')">Видалити</button>
                    </td>
                </tr>
            `;
        }).join('');

    updateTrackingSelect();
    updateStatistics();
};

// ====================================================================
// ОБРОБНИКИ ПОДІЙ (ФОРМ)
// ====================================================================

/** Обробка форми Додати/Оновити курс. */
const handleCourseFormSubmit = (e) => {
    e.preventDefault();

    const id = courseIdInput.value;
    const title = courseTitleInput.value.trim();
    const totalHours = Math.floor(parseFloat(totalHoursInput.value));
    const hoursDone = parseFloat(hoursDoneInput.value || '0');
   
    totalHoursInput.value = totalHours.toString();

    if (!validateCourseForm(title, totalHours, hoursDone)) return;
   
    const courseIndex = courses.findIndex(c => c.id === id);

    if (courseIndex !== -1) {
        Object.assign(courses[courseIndex], { name: title, totalHours, currentProgress: hoursDone });
        calculateEstimatedEndDate(courses[courseIndex]);
    } else {
        const newCourse = {
            id: Date.now().toString(), name: title, totalHours, currentProgress: hoursDone,
            progressHistory: [], averageDailyRate: 0, estimatedEndDate: '---'
        };
        calculateEstimatedEndDate(newCourse);
        courses.push(newCourse);
    }

    courseForm.reset();
    courseIdInput.value = '';
    hoursDoneInput.value = '0';
    submitCourseBtn.textContent = 'Додати';
    displayError('titleError', '');
    displayError('hoursError', '');
   
    saveToLocalStorage();
    applyFiltersAndSort();
};

/** Обробка форми Трекінгу. */
const handleTrackerFormSubmit = (e) => {
    e.preventDefault();

    const courseId = trackerCourseSelect.value;
    const studyDate = studyDateInput.value;
    const hoursTracked = parseFloat(hoursTrackedInput.value);

    // Валідація
    const today = getTodayDateString();
    const isValid = !(studyDate > today) && !isNaN(hoursTracked) && hoursTracked >= 0.1 && hoursTracked <= 12;
    displayError('trackerHoursError', isValid ? '' : 'Години мають бути числом від 0.1 до 12, і дата не може бути майбутньою.');
    if (!isValid) return;
   
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const existingRecordIndex = course.progressHistory.findIndex(r => r.date === studyDate);

    if (existingRecordIndex !== -1) {
        const oldHours = course.progressHistory[existingRecordIndex].hours;
        course.progressHistory[existingRecordIndex].hours = hoursTracked;
        course.currentProgress += hoursTracked - oldHours;
    } else {
        course.progressHistory.push({ date: studyDate, hours: hoursTracked });
        course.currentProgress += hoursTracked;
    }
    
    course.currentProgress = Math.min(course.currentProgress, course.totalHours);

    calculateEstimatedEndDate(course);
    trackerForm.reset();
    hoursTrackedInput.value = '2.5';
   
    saveToLocalStorage();
    applyFiltersAndSort();
};

/** Завантажує дані курсу у форму для редагування. */
const loadCourseForEditing = (id) => {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    courseIdInput.value = course.id;
    courseTitleInput.value = course.name;
    totalHoursInput.value = course.totalHours.toString();
    hoursDoneInput.value = course.currentProgress.toString();
   
    submitCourseBtn.textContent = 'Оновити';
    document.getElementById('courseForm').scrollIntoView({ behavior: 'smooth' });
   
    displayError('titleError', '');
    displayError('hoursError', '');
};

/** Видаляє курс. */
const deleteCourse = (id) => {
    if (!confirm('Ви впевнені, що хочете видалити цей курс?')) return;

    courses = courses.filter(c => c.id !== id);
    saveToLocalStorage();
    applyFiltersAndSort();
};

// ====================================================================
// ЕКСПОРТ/ІМПОРТ
// ====================================================================

/** Експорт даних. */
const exportData = () => {
    const dataStr = JSON.stringify(courses, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
   
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: `learning_tracker_export_${getTodayDateString()}.json` });
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/** Обробник кнопки Імпорт (викликає вікно вибору файлу). */
const handleImportClick = () => importFileInput.click();

/** Імпорт даних. */
const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target?.result);
            
            if (!Array.isArray(importedData)) {
                alert('Помилка: Невірний формат файлу. Очікувався масив.');
                return;
            }
           
            courses = importedData.map(course => {
                const { id, name, totalHours = 0, currentProgress = 0, progressHistory = [] } = course;
                return { id: id || Date.now().toString(), name, totalHours, currentProgress, progressHistory, averageDailyRate: 0, estimatedEndDate: '---' };
            });
            courses.forEach(calculateEstimatedEndDate);

            saveToLocalStorage();
            applyFiltersAndSort();
            alert('Дані успішно імпортовано та оновлено!');
        } catch (error) {
            alert('Помилка імпорту: Недійсний JSON-файл.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// ====================================================================
// ІНІЦІАЛІЗАЦІЯ
// ====================================================================

const init = () => {
    loadFromLocalStorage();

    // Встановлення обробників для форм
    courseForm?.addEventListener('submit', handleCourseFormSubmit);
    trackerForm?.addEventListener('submit', handleTrackerFormSubmit);
   
    // Встановлення обробників для експорту/імпорту
    exportBtn?.addEventListener('click', exportData);
    importBtn?.addEventListener('click', handleImportClick);
    importFileInput?.addEventListener('change', importData);

    // Встановлення обробників для керування даними
    sortSelect?.addEventListener('change', (e) => { currentSort = e.target.value; applyFiltersAndSort(); });
    filterSelect?.addEventListener('change', applyFiltersAndSort);
    searchQueryInput?.addEventListener('input', applyFiltersAndSort);
   
    // Ініціалізація полів дати
    const today = getTodayDateString();
    if(studyDateInput) {
        studyDateInput.value = today;
        studyDateInput.max = today;
    }
   
    // Первинне відображення
    applyFiltersAndSort();
};

window.addEventListener('load', init);