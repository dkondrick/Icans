document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const CSV_FILE_PATH = 'statements.csv'; // The name of your CSV file
    const CSV_CLASS_HEADER = 'ClassName';    // The exact name of the class column in your CSV
    const CSV_STATEMENT_HEADER = 'Statement'; // The exact name of the statement column

    // Get DOM elements
    const buttonsContainer = document.getElementById('class-buttons');
    const statementsContainer = document.getElementById('statements-container');

    let allStatements = []; // To store all parsed statements

    /**
     * Main function to initialize the application
     */
    async function init() {
        try {
            const csvText = await fetchCSV(CSV_FILE_PATH);
            allStatements = parseCSV(csvText);
            
            if (allStatements.length === 0) {
                statementsContainer.innerHTML = '<p>No statements found in the CSV file.</p>';
                return;
            }

            setupButtons();
            loadSavedState();

        } catch (error) {
            console.error('Initialization failed:', error);
            statementsContainer.innerHTML = '<p>Error loading statements. Please check the console and ensure the "statements.csv" file exists.</p>';
        }
    }

    /**
     * Fetches the CSV file from the server
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
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines.shift().split(',').map(h => h.trim());

        // Find the column indices by their header name
        const classIndex = headers.indexOf(CSV_CLASS_HEADER);
        const statementIndex = headers.indexOf(CSV_STATEMENT_HEADER);

        if (classIndex === -1 || statementIndex === -1) {
            throw new Error(`CSV must contain "${CSV_CLASS_HEADER}" and "${CSV_STATEMENT_HEADER}" headers.`);
        }

        return lines.map(line => {
            // Basic CSV parsing (split by comma)
            // This is simple and assumes no commas within quotes.
            const values = line.split(',');
            return {
                className: values[classIndex] ? values[classIndex].trim() : '',
                statement: values[statementIndex] ? values[statementIndex].trim() : ''
            };
        }).filter(item => item.className && item.statement); // Ensure rows are valid
    }

    /**
     * Creates a button for each unique class found in the data
     */
    function setupButtons() {
        // Get a unique set of class names
        const classNames = [...new Set(allStatements.map(item => item.className))];
        
        buttonsContainer.innerHTML = ''; // Clear loading/default text
        
        classNames.sort().forEach(name => {
            const button = document.createElement('button');
            button.textContent = name;
            // Use a data-attribute to store the class name
            button.dataset.className = name; 
            
            button.addEventListener('click', () => {
                displayStatements(name);
            });
            
            buttonsContainer.appendChild(button);
        });
    }

    /**
     * Displays the "I Can" statements for a given class
     */
    function displayStatements(className) {
        // 1. Filter the statements for the selected class
        const relevantStatements = allStatements.filter(item => item.className === className);
        
        // 2. Clear the old statements
        statementsContainer.innerHTML = '';
        
        // 3. Display the new statements
        relevantStatements.forEach(item => {
            const div = document.createElement('div');
            div.className = 'statement'; // Apply CSS class
            div.textContent = item.statement;
            statementsContainer.appendChild(div);
        });

        // 4. Update the active button
        document.querySelectorAll('#class-buttons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.className === className);
        });

        // 5. Remember this class!
        // This is the "remember where I left off" part.
        localStorage.setItem('lastViewedClass', className);
    }

    /**
     * Checks localStorage for a saved class and loads it
     */
    function loadSavedState() {
        const savedClass = localStorage.getItem('lastViewedClass');
        
        // Check if a class was saved AND if that class still exists
        const classExists = allStatements.some(item => item.className === savedClass);

        if (savedClass && classExists) {
            displayStatements(savedClass);
        } else if (allStatements.length > 0) {
            // Otherwise, just display the first class in the list
            const firstClass = allStatements[0].className;
            displayStatements(firstClass);
        }
    }

    // Run the application
    init();
});
