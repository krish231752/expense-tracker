const API_BASE = 'http://localhost:5000';

// Notification function (Enhanced: Use CSS classes for better styling)
function showNotification(message, type = 'success') {
    const notifDiv = document.getElementById('notifications');
    if (!notifDiv) {
        alert(message); // Fallback
        return;
    }
    const notif = document.createElement('div');
    notif.className = `notification ${type === 'error' ? 'error' : ''}`; // Use CSS classes
    notif.textContent = message;
    notifDiv.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// Load Categories (Corrected: Consistent IDs, event in onclick)
function loadCategories() {
    fetch(`${API_BASE}/categories`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            const tbody = document.querySelector('#categoriesTable tbody');
            if (!tbody) return showNotification('Table not found', 'error'); // Safeguard
            tbody.innerHTML = '';
            data.forEach(cat => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${cat.id}</td>
                    <td>
                        <span id="catName_${cat.id}">${cat.name}</span>
                        <input type="text" id="editName_${cat.id}" value="${cat.name}" style="display:none; width:100px;">
                    </td>
                    <td>
                        <span id="catBudget_${cat.id}">$${parseFloat(cat.budget_limit).toFixed(2)}</span>
                        <input type="number" id="editBudget_${cat.id}" value="${cat.budget_limit}" step="0.01" style="display:none; width:80px;">
                    </td>
                    <td>
                        <button class="edit-btn" onclick="toggleEditCat(event, ${cat.id})">Edit</button>
                        <button class="delete-btn" onclick="deleteCategory(${cat.id})">Delete</button>
                    </td>
                `;
            });
            const addForm = document.getElementById('addCategoryForm');
            if (addForm) addForm.style.display = 'block';
            populateCategorySelect(data);
        })
        .catch(err => {
            console.error('Load categories error:', err); // Debug
            showNotification('Error loading categories: ' + err.message, 'error');
        });
}

// Add Category 
document.addEventListener('DOMContentLoaded', () => {
    const addCatForm = document.getElementById('addCategoryForm');
    if (addCatForm) {
        addCatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('catName')?.value?.trim();
            const budget = parseFloat(document.getElementById('catBudget')?.value);
            if (!name || isNaN(budget) || budget <= 0) return showNotification('Invalid input: Name required, budget > 0', 'error');
            fetch(`${API_BASE}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, budget_limit: budget })
            })
            .then(res => {
                if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
                return res.json();
            })
            .then(() => {
                showNotification('Category added!');
                addCatForm.reset();
                loadCategories();
            })
            .catch(err => showNotification('Error adding category: ' + err.message, 'error'));
        });
    }

    // Add Expense 
    const addExpForm = document.getElementById('addExpenseForm');
    if (addExpForm) {
        addExpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const category_id = parseInt(document.getElementById('expCategory')?.value);
            const amount = parseFloat(document.getElementById('expAmount')?.value);
            const description = document.getElementById('expDescription')?.value?.trim();
            const expense_date = document.getElementById('expDate')?.value;
            if (!category_id || isNaN(amount) || amount <= 0 || !description || !expense_date) {
                return showNotification('Invalid input: Select category, amount > 0, description and date required', 'error');
            }
            fetch(`${API_BASE}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id, amount, description, expense_date })
            })
            .then(res => {
                if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
                return res.json();
            })
            .then(() => {
                showNotification('Expense added!');
                addExpForm.reset();
                loadExpenses();
            })
            .catch(err => showNotification('Error adding expense: ' + err.message, 'error'));
        });
    }
});

// Toggle Edit for Category
function toggleEditCat(event, id) {
    console.log('Toggling edit for ID:', id); // Debug
    const editBtn = event.target;
    const nameSpan = document.getElementById(`catName_${id}`);
    const nameInput = document.getElementById(`editName_${id}`);
    const budgetSpan = document.getElementById(`catBudget_${id}`);
    const budgetInput = document.getElementById(`editBudget_${id}`);
    
    if (!nameSpan || !nameInput || !budgetSpan || !budgetInput || !editBtn) {
        console.error('Missing elements for ID:', id);
        showNotification('Edit elements not found—reload and try again', 'error');
        return;
    }
    
    if (nameInput.style.display === 'none') {
        nameSpan.style.display = 'none';
        budgetSpan.style.display = 'none';
        nameInput.style.display = 'inline';
        budgetInput.style.display = 'inline';
        editBtn.textContent = 'Save';
        editBtn.classList.add('save-mode');
        editBtn.onclick = (e) => saveUpdateCat(e, id);
    } else {
        saveUpdateCat(event, id);
    }
}

// **FINAL CORRECTED saveUpdateCat FUNCTION**
function saveUpdateCat(event, id) { 
    console.log('Saving for ID:', id); // Debug
    const nameInput = document.getElementById(`editName_${id}`);
    const budgetInput = document.getElementById(`editBudget_${id}`);
    
    // Get new name, trimmed. If the input element exists but is empty, newName is "".
    const newName = nameInput ? nameInput.value.trim() : undefined;
    const budget = parseFloat(budgetInput ? budgetInput.value : 0);
    
    if (isNaN(budget) || budget <= 0) {
        showNotification('Budget must be a positive number!', 'error');
        return;
    }
    
    // Check if the name input exists and results in an empty string after trimming.
    if (nameInput && newName === "") { 
        showNotification('Name cannot be empty!', 'error');
        return;
    }
    
    const editBtn = event.target.closest('button');
    if (!editBtn) {
        showNotification('Save button not found', 'error');
        return;
    }
    
    // Dynamic body: START with budget
    const updateBody = { budget_limit: budget };
    
    // ONLY include the name property if newName is a non-empty string.
    if (newName !== undefined && newName !== "") { 
        updateBody.name = newName;
    }
    
    console.log('Sending PUT body:', updateBody); // Debug
    
    fetch(`${API_BASE}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
    })
    .then(res => {
        // IMPORTANT: The backend sends a 4xx or 5xx status and returns JSON with an 'error' field
        if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`); });
        
        // This catch block handles the original issue: if the backend sends HTML, 
        // res.json() will fail and the promise will reject with the Unexpected token '<' error.
        return res.json();
    })
    .then(() => {
        showNotification('Category updated!');
        editBtn.textContent = 'Edit';
        editBtn.classList.remove('save-mode');
        editBtn.onclick = (e) => toggleEditCat(e, id);
        
        // Update spans immediately 
        const nameSpan = document.getElementById(`catName_${id}`);
        const budgetSpan = document.getElementById(`catBudget_${id}`);
        
        if (nameSpan) {
            nameSpan.textContent = updateBody.name || nameSpan.textContent;
            nameSpan.style.display = 'inline';
            nameInput.style.display = 'none';
        }
        if (budgetSpan) {
            budgetSpan.textContent = `$${budget.toFixed(2)}`;
            budgetSpan.style.display = 'inline';
            budgetInput.style.display = 'none';
        }
        
        loadCategories(); // Refresh for consistency
    })
    .catch(err => {
        console.error('Update error:', err);
        showNotification('Error updating category: ' + err.message, 'error');
        // Restore 'Save' button state so the user can try again
        editBtn.textContent = 'Save';
        editBtn.classList.add('save-mode');
    });
}

// Delete Category 
function deleteCategory(id) {
    if (confirm('Delete this category? Related expenses will be deleted.')) {
        fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' })
        .then(res => {
            if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
            return res.json();
        })
        .then(() => {
            showNotification('Category deleted!');
            loadCategories();
        })
        .catch(err => showNotification('Error deleting category: ' + err.message, 'error'));
    }
}

// Populate Category Select 
function populateCategorySelect(data) {
    const select = document.getElementById('expCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Select Category</option>';
    data.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
}

// Load Expenses 
function loadExpenses() {
    fetch(`${API_BASE}/expenses`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            const tbody = document.querySelector('#expensesTable tbody');
            if (!tbody) return showNotification('Expenses table not found', 'error');
            tbody.innerHTML = '';
            data.forEach(exp => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${exp.id}</td>
                    <td>${exp.category_name}</td>
                    <td>
                        <span id="amount_${exp.id}">$${parseFloat(exp.amount).toFixed(2)}</span>
                        <input type="number" id="editAmount_${exp.id}" value="${exp.amount}" step="0.01" style="display:none; width:60px;">
                    </td>
                    <td>
                        <span id="desc_${exp.id}">${exp.description}</span>
                        <input type="text" id="editDesc_${exp.id}" value="${exp.description}" style="display:none; width:100px;">
                    </td>
                    <td>${new Date(exp.expense_date).toLocaleDateString()}</td>
                    <td>
                        <button class="edit-btn" onclick="toggleEdit(event, ${exp.id})">Edit</button>
                        <button class="delete-btn" onclick="deleteExpense(${exp.id})">Delete</button>
                    </td>
                `;
            });
            const addForm = document.getElementById('addExpenseForm');
            if (addForm) addForm.style.display = 'block';
        })
        .catch(err => {
            console.error('Load expenses error:', err);
            showNotification('Error loading expenses: ' + err.message, 'error');
        });
}

// Toggle Edit for Expense 
function toggleEdit(event, id) {
    console.log('Toggling expense edit for ID:', id); // Debug
    const editBtn = event.target;
    const amountSpan = document.getElementById(`amount_${id}`);
    const descSpan = document.getElementById(`desc_${id}`);
    const amountInput = document.getElementById(`editAmount_${id}`);
    const descInput = document.getElementById(`editDesc_${id}`);
    
    if (!amountSpan || !descSpan || !amountInput || !descInput || !editBtn) {
        showNotification('Edit elements not found for expense', 'error');
        return;
    }
    
    if (amountInput.style.display === 'none') {
        amountSpan.style.display = 'none';
        descSpan.style.display = 'none';
        amountInput.style.display = 'inline';
        descInput.style.display = 'inline';
        editBtn.textContent = 'Save';
        editBtn.classList.add('save-mode');
        editBtn.onclick = (e) => saveUpdateExpense(e, id); 
    } else {
        saveUpdateExpense(event, id);
    }
}

// Save Update for Expense 
function saveUpdateExpense(event, id) {
    console.log('Saving expense for ID:', id); // Debug
    const amountInput = document.getElementById(`editAmount_${id}`);
    const descInput = document.getElementById(`editDesc_${id}`);
    const amount = parseFloat(amountInput ? amountInput.value : 0);
    const description = descInput ? descInput.value.trim() : '';

    if (isNaN(amount) || amount <= 0 || !description) {
        showNotification('Invalid: Amount > 0, description required', 'error');
        return;
    }

    const editBtn = event.target.closest('button');
    if (!editBtn) {
        showNotification('Save button not found', 'error');
        return;
    }

    fetch(`${API_BASE}/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description })
    })
    .then(res => {
        if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
        return res.json();
    })
    .then(() => {
        showNotification('Expense updated!');
        
        editBtn.textContent = 'Edit';
        editBtn.classList.remove('save-mode');
        editBtn.onclick = (e) => toggleEdit(e, id); 
        
        const amountSpan = document.getElementById(`amount_${id}`);
        const descSpan = document.getElementById(`desc_${id}`);
        
        if (amountSpan) {
            amountSpan.textContent = `$${amount.toFixed(2)}`;
            amountSpan.style.display = 'inline';
        }
        if (descSpan) {
            descSpan.textContent = description;
            descSpan.style.display = 'inline';
        }
        amountInput.style.display = 'none';
        descInput.style.display = 'none';

        loadExpenses(); 
    })
    .catch(err => {
        console.error('Update expense error:', err);
        showNotification('Error updating expense: ' + err.message, 'error');
        editBtn.textContent = 'Save';
        editBtn.classList.add('save-mode');
        editBtn.onclick = (e) => saveUpdateExpense(e, id); 
    });
}

// Variable to hold the Chart.js instance
let spendingChartInstance = null; 

// Function to generate and display the monthly spending report
function loadReport() {
    const monthInput = document.getElementById('reportMonth');
    // Get month value from input (e.g., "2023-10")
    const selectedMonth = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7); 
    
    const url = `${API_BASE}/reports/monthly?month=${selectedMonth}`;

    fetch(url)
        .then(res => {
            if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
            return res.json();
        })
        .then(data => {
            const tbody = document.querySelector('#reportsTable tbody');
            if (!tbody) return showNotification('Report table body not found', 'error');

            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No expenses found for the selected month.</td></tr>';
                renderChart(data); // Clear the chart
                return showNotification('Report generated: No expenses found.');
            }

            data.forEach(item => {
                const row = tbody.insertRow();
                // Calculate Remaining/Over to display in the Status column
                const remaining = parseFloat(item.budget_limit) - parseFloat(item.total_spent);
                const statusText = item.status; // Comes directly from SQL query
                
                // Add the Status column content (Status + Remaining/Over)
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>$${parseFloat(item.total_spent).toFixed(2)}</td>
                    <td>$${parseFloat(item.budget_limit).toFixed(2)}</td>
                    <td style="color: ${statusText.includes('Over') ? 'red' : 'green'}; font-weight: bold;">
                        ${statusText} ($${remaining.toFixed(2)})
                    </td>
                `;
            });
            
            // Render the chart based on the fetched data
            renderChart(data);
            showNotification('Monthly report generated successfully!');
        })
        .catch(err => {
            console.error('Report generation error:', err);
            showNotification('Error generating report: ' + err.message, 'error');
            // Ensure the chart is cleared on error
            renderChart([]); 
        });
}

// Function to render the Chart.js graph
function renderChart(data) {
    const ctx = document.getElementById('spendingChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart instance if it exists
    if (spendingChartInstance) {
        spendingChartInstance.destroy();
    }

    const labels = data.map(item => item.name);
    const spending = data.map(item => item.total_spent);
    const limits = data.map(item => item.budget_limit);
    
    spendingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Spent',
                    data: spending,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red for spent
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Budget Limit',
                    data: limits,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue for limit
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Spending vs. Budget'
                }
            }
        }
    });
}
// Delete Expense 
function deleteExpense(id) {
    if (confirm('Delete this expense?')) {
        fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' })
        .then(res => {
            if (!res.ok) return res.json().then(errData => { throw new Error(errData.error || `HTTP ${res.status}`); });
            return res.json();
        })
        .then(() => {
            showNotification('Expense deleted!');
            loadExpenses();
        })
        .catch(err => showNotification('Error deleting expense: ' + err.message, 'error'));
    }
}

// Initial loads
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadExpenses();
});