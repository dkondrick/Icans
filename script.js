document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const CSV_FILE_PATH = 'statements.csv'; 
    const CSV_CLASS_HEADER = 'ClassName';    
    const CSV_STATEMENT_HEADER = 'Statement'; 
    const CSV_DAY_HEADER = 'Day'; // <-- NEW: The header for the day number

    // --- DOM Elements ---
    const classButtonsContainer = document.getElementById('class-buttons');
    const dayManagerContainer = document.getElementById('day-manager');
    const statementsContainer = document.getElementById('statements-container');

    // --- Application State ---
    let allStatements = []; // Holds all parsed CSV data
    let allDaysByClass = {}; // Holds available days for each class, e.g., {"Math 8": [1, 2, 3, 5]}
    let classDayCounters = {}; // Holds the *currently selected* day for each class, e.g., {"Math 8": 2}

    /**
     * Main function to initialize the application
     */
    async function init() {
        try {
            // 1. Load and parse the CSV
            const csvText = await fetchCSV(CSV_FILE_PATH);
            allStatements = parseCSV(csvText);
            
            if (allStatements.length === 0) {
                statementsContainer.innerHTML = '<p>No statements found in the CSV file.</p>';
                return;
            }

            // 2. Process data and load saved state
            buildClassDayMap();
            loadSavedState();

            // 3. Set up the UI
            setupClassButtons();
            
            // 4. Load the initial view based on saved state
            const lastClass = localStorage.getItem('lastViewedClass');
            const classToLoad = (lastClass && allDaysByClass[lastClass]) 
                ? lastClass 
                : Object.keys(allDaysByClass)[0]; // Load last class or default to first
            
            if (classToLoad) {
                selectClass(classToLoad);
            } else {
                statementsContainer.innerHTML = '<p>No valid class data found.</p>';
            }

        } catch (error) {
            console.error('Initialization failed:', error);
            statementsContainer.innerHTML = `<p>Error loading statements: ${error.message}</p>`;
        }
    }

    /**
     * Fetches the CSV file
     */
    async function fetchCSV(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return await response.text();
    }

    /**
     * Parses the raw CSV text into an array of objects
     */
/**
 * Helper function to parse a single line of CSV, handling quoted fields.
 */
function parseCSVLine(line) {
    const values = [];
    let inQuote = false;
    let currentValue = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            // Toggle inQuote state, but skip adding the quote to the value
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            // If we hit a comma and we're not in a quote, end the current value
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            // Add the character to the current value
            currentValue += char;
        }
    }
    // Add the last value after the loop finishes
    values.push(currentValue.trim()); 
    
    // Remove any surrounding quotes that might remain (e.g., from an unquoted field)
    return values.map(v => v.replace(/^"|"$/g, '')); 
}

/**
 * Parses the raw CSV text into an array of objects
 */
function parseCSV(text) {
    const lines = text.trim().split('\n');
    // Use the new line parser for headers too
    const headers = parseCSVLine(lines.shift()); 

    const classIndex = headers.indexOf(CSV_CLASS_HEADER);
    const statementIndex = headers.indexOf(CSV_STATEMENT_HEADER);
    const dayIndex = headers.indexOf(CSV_DAY_HEADER);

    if (classIndex === -1 || statementIndex === -1 || dayIndex === -1) {
        throw new Error(`CSV must contain "${CSV_CLASS_HEADER}", "${CSV_STATEMENT_HEADER}", and "${CSV_DAY_HEADER}" headers.`);
    }

    return lines.map(line => {
        if (!line) return null; // Skip empty lines
        
        const values = parseCSVLine(line);
        
        if (values.length !== headers.length) {
            console.warn('Skipping malformed CSV line:', line);
            return null;
        }
        
        const day = parseInt(values[dayIndex], 10);
        return {
            className: values[classIndex],
            statement: values[statementIndex],
            day: day
        };
    }).filter(item => item && item.className && item.statement && !isNaN(item.day)); // Filter out nulls and invalid data
}

    /**
     * Creates a map of which days are available for each class
     * Populates the `allDaysByClass` object
     */
    function buildClassDayMap() {
        allStatements.forEach(item => {
            if (!allDaysByClass[item.className]) {
                allDaysByClass[item.className] = new Set();
            }
            allDaysByClass[item.className].add(item.day);
        });

        // Convert sets to sorted number arrays
        for (const className in allDaysByClass) {
            allDaysByClass[className] = [...allDaysByClass[className]].sort((a, b) => a - b);
        }
    }

    /**
     * Loads the saved day counters from localStorage
     */
    function loadSavedState() {
        classDayCounters = JSON.parse(localStorage.getItem('classDayCounters')) || {};
    }

    /**
     * Saves the current day counters to localStorage
     */
    function saveState() {
        localStorage.setItem('classDayCounters', JSON.stringify(classDayCounters));
    }

    /**
     * Creates a button for each unique class
     */
    function setupClassButtons() {
        const classNames = Object.keys(allDaysByClass).sort();
        classButtonsContainer.innerHTML = ''; 
        
        classNames.forEach(name => {
            const button = document.createElement('button');
            button.textContent = name;
            button.dataset.className = name; 
            button.addEventListener('click', () => selectClass(name));
            classButtonsContainer.appendChild(button);
        });
    }

    /**
     * Called when a class button is clicked.
     * This is the main controller for changing the view.
     */
    function selectClass(className) {
        // 1. Update active button
        document.querySelectorAll('#class-buttons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.className === className);
        });

        // 2. Remember this as the last viewed class
        localStorage.setItem('lastViewedClass', className);

        // 3. Get the days for this class
        const availableDays = allDaysByClass[className];
        if (!availableDays || availableDays.length === 0) {
            dayManagerContainer.innerHTML = '';
            statementsContainer.innerHTML = '<p>No statements found for this class.</p>';
            return;
        }

        // 4. Find the current day (from memory, or default to first day)
        let currentDay = classDayCounters[className] || availableDays[0];

        // 5. Sanity check: If the saved day no longer exists (e.g., CSV changed), reset to Day 1
        if (!availableDays.includes(currentDay)) {
            currentDay = availableDays[0];
            classDayCounters[className] = currentDay;
            saveState();
        }

        // 6. Build the Day Manager UI (Prev/Next buttons)
        setupDayManager(className, currentDay);

        // 7. Display the statements for that class and day
        displayStatements(className, currentDay);
    }

    /**
     * Renders the "Previous", "Current Day", and "Next" UI
     */
    function setupDayManager(className, currentDay) {
        const availableDays = allDaysByClass[className];
        const currentDayIndex = availableDays.indexOf(currentDay);

        const hasPrev = currentDayIndex > 0;
        const hasNext = currentDayIndex < availableDays.length - 1;

        dayManagerContainer.innerHTML = `
            <button id="day-prev" ${!hasPrev ? 'disabled' : ''}>&laquo; Previous</button>
            <span id="day-current">Day ${currentDay}</span>
            <button id="day-next" ${!hasNext ? 'disabled' : ''}>Next &raquo;</button>
        `;

        // Add event listeners
        if (hasPrev) {
            document.getElementById('day-prev').addEventListener('click', () => {
                changeDay(className, availableDays[currentDayIndex - 1]);
            });
        }
        if (hasNext) {
            document.getElementById('day-next').addEventListener('click', () => {
                changeDay(className, availableDays[currentDayIndex + 1]);
            });
        }
    }

    /**
     * Called when "Previous" or "Next" is clicked
     */
    function changeDay(className, newDay) {
        // 1. Update the state
        classDayCounters[className] = newDay;
        saveState();

        // 2. Re-render the UI for the new day
        setupDayManager(className, newDay);
        displayStatements(className, newDay);
    }

    /**
     * Displays the "I Can" statements for a given class AND day
     */
    function displayStatements(className, day) {
        const relevantStatements = allStatements.filter(
            item => item.className === className && item.day === day
        );
        
        statementsContainer.innerHTML = '';
        
        if (relevantStatements.length === 0) {
            statementsContainer.innerHTML = '<p>No statements scheduled for this day.</p>';
            return;
        }

        relevantStatements.forEach(item => {
            const div = document.createElement('div');
            div.className = 'statement';
            div.textContent = item.statement;
            statementsContainer.appendChild(div);
        });
    }

    // Run the application
    init();
});
