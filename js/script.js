
// =============================================
// KANBANKU - JAVASCRIPT UTAMA
// =============================================


// 1. DATA KOLOM KANBAN

const DEFAULT_COLUMNS = [
    { id: "backlog", title: "BACKLOG", color: "backlog-dot" },
    { id: "doing", title: "DIKERJAKAN", color: "doing-dot" },
    { id: "review", title: "DITINJAU", color: "review-dot" },
    { id: "done", title: "SELESAI", color: "done-dot" }
];

const COLUMN_STORAGE_KEY = "kanbanku_columns";
const STORAGE_KEY = "kanbanku_tasks";

function loadColumns() {
    try {
        const saved = localStorage.getItem(COLUMN_STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Gagal membaca kolom:", error);
    }

    return DEFAULT_COLUMNS.map(column => ({ ...column }));
}

let columns = loadColumns();

function saveColumns() {
    localStorage.setItem(
        COLUMN_STORAGE_KEY,
        JSON.stringify(columns)
    );
}


// 2. DATA CONTOH TUGAS

const sampleTasks = [
    {
        id: 1,
        title: "Riset kebutuhan pengguna",
        description: "Wawancara 5 pengguna untuk memetakan masalah utama.",
        priority: "Sedang",
        label: "Riset",
        deadline: "2026-11-29",
        status: "backlog"
    },
    {
        id: 2,
        title: "Menyusun peta jalan produk",
        description: "Tentukan target rilis kuartal depan.",
        priority: "Rendah",
        label: "Perencanaan",
        deadline: "2026-12-07",
        status: "backlog"
    },
    {
        id: 3,
        title: "Desain halaman beranda",
        description: "Wireframe dan prototype interaktif di Figma.",
        priority: "Tinggi",
        label: "Desain",
        deadline: "2026-11-25",
        status: "doing"
    },
    {
        id: 4,
        title: "Integrasi API pembayaran",
        description: "Sambungkan gateway pembayaran.",
        priority: "Tinggi",
        label: "Backend",
        deadline: "2026-11-22",
        status: "doing"
    },
    {
        id: 5,
        title: "Uji kegunaan prototype",
        description: "Hasil uji dengan 8 peserta menunggu ditinjau.",
        priority: "Sedang",
        label: "QA",
        deadline: "2026-11-26",
        status: "review"
    },
    {
        id: 6,
        title: "Menyiapkan repositori proyek",
        description: "Struktur folder dan pipeline CI dasar.",
        priority: "Rendah",
        label: "DevOps",
        deadline: "2026-11-18",
        status: "done"
    },
    {
        id: 7,
        title: "Rapat kickoff tim",
        description: "Pembagian peran dan kesepakatan alur kerja.",
        priority: "Rendah",
        label: "Umum",
        deadline: "2026-11-16",
        status: "done"
    }
];


// 3. PENYIMPANAN TUGAS

function loadTasks() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Gagal membaca tugas:", error);
    }

    return sampleTasks.map(task => ({ ...task }));
}

let tasks = loadTasks();
let editingTaskId = null;
let selectedStatus = "backlog";
let draggedTaskId = null;
let toastTimer;

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}


// 4. MENGAMBIL ELEMEN HTML

const board = document.getElementById("kanbanBoard");
const modal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const searchInput = document.getElementById("searchInput");
const priorityFilter = document.getElementById("priorityFilter");


// 5. NOTIFIKASI

function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// 6. FORMAT TANGGAL

function formatDate(date) {
    if (!date) return "";

    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isOverdue(task) {
    if (!task.deadline || task.status === "done") {
        return false;
    }

    const today = new Date();

    const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    return task.deadline < todayString;
}


// 7. MEMBUAT TAMPILAN PAPAN KANBAN

function renderBoard() {
    if (!board) return;

    board.innerHTML = "";

    columns.forEach(column => {

        const columnTasks = tasks.filter(
            task => task.status === column.id
        );

        const columnElement = document.createElement("section");
        columnElement.className = "kanban-column";

        // HEADER KOLOM

        const header = document.createElement("div");
        header.className = "column-header";

        const title = document.createElement("div");
        title.className = "column-title";

        const dot = document.createElement("span");
        dot.className = `column-dot ${column.color}`;

        const titleText = document.createElement("span");
        titleText.textContent = column.title;

        title.append(dot, titleText);

        const count = document.createElement("span");
        count.className = "column-count";
        count.textContent = columnTasks.length;

        // TOMBOL EDIT DAN HAPUS KOLOM

        const columnActions = document.createElement("div");
        columnActions.className = "column-actions";

        const editColumnButton = document.createElement("button");
        editColumnButton.type = "button";
        editColumnButton.textContent = "✎";
        editColumnButton.title = "Ubah nama kolom";

        editColumnButton.addEventListener("click", () => {
            editColumn(column.id);
        });

        const deleteColumnButton = document.createElement("button");
        deleteColumnButton.type = "button";
        deleteColumnButton.textContent = "▤";
        deleteColumnButton.title = "Hapus kolom";

        deleteColumnButton.addEventListener("click", () => {
            deleteColumn(column.id);
        });

        columnActions.append(
            editColumnButton,
            deleteColumnButton
        );

        header.append(title, count, columnActions);


        // DAFTAR TUGAS

        const list = document.createElement("div");
        list.className = "task-list";
        list.id = column.id;

        list.addEventListener("dragover", handleDragOver);
        list.addEventListener("dragleave", handleDragLeave);

        list.addEventListener("drop", event => {
            handleDrop(event, column.id);
        });

        columnTasks.forEach(task => {
            if (matchesFilter(task)) {
                list.appendChild(createTaskCard(task));
            }
        });

        if (columnTasks.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-message";
            empty.textContent = "Belum ada tugas";
            list.appendChild(empty);
        } else if (!list.querySelector(".task-card")) {
            const empty = document.createElement("div");
            empty.className = "empty-message";
            empty.textContent = "Tidak ada tugas yang cocok";
            list.appendChild(empty);
        }


        // TOMBOL TAMBAH TUGAS

        const addButton = document.createElement("button");
        addButton.className = "add-task-button";
        addButton.textContent = "+ Tambah tugas";

        addButton.addEventListener("click", () => {
            openAddModal(column.id);
        });

        columnElement.append(header, list, addButton);
        board.appendChild(columnElement);
    });


    // TOMBOL TAMBAH KOLOM

    const addColumnButton = document.createElement("button");

    addColumnButton.type = "button";
    addColumnButton.className = "add-column-button";
    addColumnButton.textContent = "+ Tambah kolom";

    addColumnButton.addEventListener("click", addColumn);

    board.appendChild(addColumnButton);

    updateStatistics();
}


// 8. PENCARIAN DAN FILTER

function matchesFilter(task) {
    const keyword = searchInput.value.toLowerCase().trim();
    const priority = priorityFilter.value;

    const text = [
        task.title,
        task.description,
        task.label
    ].join(" ").toLowerCase();

    const matchesSearch = text.includes(keyword);

    const matchesPriority =
        priority === "all" || task.priority === priority;

    return matchesSearch && matchesPriority;
}


// 9. MEMBUAT KARTU TUGAS

function createTaskCard(task) {
    const card = document.createElement("article");

    card.className =
        `task-card priority-${task.priority.toLowerCase()}`;

    card.draggable = true;
    card.dataset.id = task.id;

    card.addEventListener("dragstart", event => {
        draggedTaskId = Number(task.id);
        card.classList.add("dragging");

        event.dataTransfer.setData(
            "text/plain",
            String(task.id)
        );
    });

    card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        draggedTaskId = null;
    });

    const title = document.createElement("h3");
    title.textContent = task.title;

    const description = document.createElement("p");
    description.textContent =
        task.description || "Tidak ada deskripsi.";

    const labels = document.createElement("div");
    labels.className = "task-labels";

    const priority = document.createElement("span");

    priority.className =
        `priority-label priority-${task.priority.toLowerCase()}`;

    priority.textContent = task.priority;

    labels.appendChild(priority);

    if (task.label) {
        const label = document.createElement("span");
        label.className = "category-label";
        label.textContent = task.label;

        labels.appendChild(label);
    }

    card.append(title, description, labels);

    if (task.deadline) {
        const date = document.createElement("div");

        date.className = "task-date";
        date.textContent = `▦ ${formatDate(task.deadline)}`;

        if (isOverdue(task)) {
            date.classList.add("overdue");
            date.textContent += " - Terlambat";
        }

        card.appendChild(date);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✎ Edit";

    editButton.addEventListener("click", () => {
        openEditModal(task.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-task";
    deleteButton.textContent = "✕ Hapus";

    deleteButton.addEventListener("click", () => {
        deleteTask(task.id);
    });

    actions.append(editButton, deleteButton);
    card.appendChild(actions);

    return card;
}


// 10. STATISTIK TUGAS

function updateStatistics() {
    const total = tasks.length;

    const completed = tasks.filter(
        task => task.status === "done"
    ).length;

    const late = tasks.filter(isOverdue).length;

    const percent = total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("lateTasks").textContent = late;

    document.getElementById("completionPercent").textContent =
        `(${percent}%)`;
}


// 11. TAMBAH TUGAS

function openAddModal(status) {
    editingTaskId = null;
    selectedStatus = status;

    taskForm.reset();

    document.getElementById("modalTitle").textContent = "Tugas baru";
    document.getElementById("taskPriority").value = "Sedang";

    modal.classList.add("active");

    document.getElementById("taskTitle").focus();
}


// 12. EDIT TUGAS

function openEditModal(id) {
    const task = tasks.find(
        item => Number(item.id) === Number(id)
    );

    if (!task) return;

    editingTaskId = id;
    selectedStatus = task.status;

    document.getElementById("modalTitle").textContent = "Edit tugas";
    document.getElementById("taskTitle").value = task.title;

    document.getElementById("taskDescription").value =
        task.description || "";

    document.getElementById("taskPriority").value =
        task.priority;

    document.getElementById("taskDeadline").value =
        task.deadline || "";

    document.getElementById("taskLabel").value =
        task.label || "";

    modal.classList.add("active");
}


// 13. MENUTUP FORM

function closeModal() {
    modal.classList.remove("active");
    editingTaskId = null;
}

document.getElementById("closeModalButton")
    .addEventListener("click", closeModal);

document.getElementById("cancelButton")
    .addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});


// 14. SIMPAN DAN UPDATE TUGAS

taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = document
        .getElementById("taskTitle")
        .value.trim();

    if (!title) {
        showToast("Judul tugas wajib diisi!");
        return;
    }

    const taskData = {
        title: title,

        description: document
            .getElementById("taskDescription")
            .value.trim(),

        priority: document
            .getElementById("taskPriority").value,

        deadline: document
            .getElementById("taskDeadline").value,

        label: document
            .getElementById("taskLabel")
            .value.trim()
    };

    if (editingTaskId !== null) {
        const index = tasks.findIndex(
            task => Number(task.id) === Number(editingTaskId)
        );

        if (index !== -1) {
            tasks[index] = {
                ...tasks[index],
                ...taskData
            };
        }

        showToast("Tugas berhasil diperbarui!");

    } else {
        tasks.push({
            id: Date.now(),
            ...taskData,
            status: selectedStatus
        });

        showToast("Tugas berhasil ditambahkan!");
    }

    saveTasks();
    renderBoard();
    closeModal();
});


// 15. HAPUS TUGAS

function deleteTask(id) {
    const confirmation = confirm(
        "Apakah kamu yakin ingin menghapus tugas ini?"
    );

    if (!confirmation) return;

    tasks = tasks.filter(
        task => Number(task.id) !== Number(id)
    );

    saveTasks();
    renderBoard();

    showToast("Tugas berhasil dihapus!");
}


// 16. DRAG AND DROP

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove("drag-over");
}

function handleDrop(event, newStatus) {
    event.preventDefault();

    event.currentTarget.classList.remove("drag-over");

    const id = Number(
        event.dataTransfer.getData("text/plain") || draggedTaskId
    );

    const task = tasks.find(
        item => Number(item.id) === id
    );

    if (!task) return;

    task.status = newStatus;

    saveTasks();
    renderBoard();

    showToast("Status tugas berhasil dipindahkan!");
}


// 17. EVENT PENCARIAN DAN FILTER

searchInput.addEventListener("input", renderBoard);
priorityFilter.addEventListener("change", renderBoard);


// 18. DARK MODE

const THEME_KEY = "kanbanku_theme";

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}

function updateThemeButton() {
    const button = document.getElementById("themeButton");

    button.textContent =
        document.body.classList.contains("dark-mode")
        ? "☀️ Tema"
        : "🌙 Tema";
}

document.getElementById("themeButton")
    .addEventListener("click", () => {

        document.body.classList.toggle("dark-mode");

        const theme = document.body.classList.contains("dark-mode")
            ? "dark"
            : "light";

        localStorage.setItem(THEME_KEY, theme);

        updateThemeButton();
    });


// 19. RESET DATA

document.getElementById("resetButton")
    .addEventListener("click", () => {

        const confirmation = confirm(
            "Reset akan mengembalikan semua tugas ke data contoh. Lanjutkan?"
        );

        if (!confirmation) return;

        tasks = sampleTasks.map(task => ({ ...task }));

        saveTasks();
        renderBoard();

        showToast("Tugas berhasil direset!");
    });


// 20. TAMBAH DAN EDIT KOLOM MENGGUNAKAN MODAL

const columnModal = document.getElementById("columnModal");
const columnForm = document.getElementById("columnForm");
const columnNameInput = document.getElementById("columnName");
const columnModalTitle = document.getElementById("columnModalTitle");
const saveColumnButton = document.getElementById("saveColumnButton");

let editingColumnId = null;


// MEMBUKA MODAL

function openColumnModal(columnId = null) {

    editingColumnId = columnId;
    columnForm.reset();

    if (columnId) {

        const column = columns.find(
            item => item.id === columnId
        );

        if (!column) return;

        columnModalTitle.textContent = "Edit kolom";
        saveColumnButton.textContent = "Simpan";
        columnNameInput.value = column.title;

    } else {

        columnModalTitle.textContent = "Kolom baru";
        saveColumnButton.textContent = "Tambah";
        columnNameInput.value = "";

    }

    columnModal.classList.add("active");

    setTimeout(() => {
        columnNameInput.focus();
    }, 50);
}


// MENUTUP MODAL

function closeColumnModal() {

    columnModal.classList.remove("active");
    columnForm.reset();
    editingColumnId = null;

}


// FUNGSI TAMBAH KOLOM

function addColumn() {
    openColumnModal();
}


// FUNGSI EDIT KOLOM

function editColumn(id) {
    openColumnModal(id);
}


// TOMBOL TUTUP

document.getElementById("closeColumnModalButton")
    .addEventListener("click", closeColumnModal);

document.getElementById("cancelColumnButton")
    .addEventListener("click", closeColumnModal);


// KLIK DI LUAR MODAL

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        if (columnModal.classList.contains("active")) {

            closeColumnModal();

        } else {

            closeModal();

        }

    }

});


// SIMPAN KOLOM BARU ATAU EDIT KOLOM

columnForm.addEventListener("submit", event => {

    event.preventDefault();

    const cleanTitle = columnNameInput.value.trim();

    // Validasi nama kosong

    if (!cleanTitle) {
        showToast("Nama kolom wajib diisi!");
        columnNameInput.focus();
        return;
    }

    // Mencegah nama kolom duplikat

    const exists = columns.some(column =>
        column.id !== editingColumnId &&
        column.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (exists) {
        showToast("Nama kolom sudah digunakan!");
        columnNameInput.focus();
        return;
    }

    // Jika sedang mengedit kolom

    if (editingColumnId) {

        const column = columns.find(
            item => item.id === editingColumnId
        );

        if (!column) return;

        column.title = cleanTitle.toUpperCase();

        showToast("Nama kolom berhasil diubah!");

    }

    // Jika menambahkan kolom baru

    else {

        columns.push({

            id: "column-" + Date.now(),

            title: cleanTitle.toUpperCase(),

            color: "review-dot"

        });

        showToast("Kolom berhasil ditambahkan!");

    }

    // Simpan dan tampilkan ulang papan

    saveColumns();

    renderBoard();

    closeColumnModal();

});


// 21. EDIT NAMA KOLOM

function editColumn(id) {
    const column = columns.find(
        item => item.id === id
    );

    if (!column) return;

    const newTitle = prompt(
        "Masukkan nama kolom baru:",
        column.title
    );

    if (!newTitle || !newTitle.trim()) return;

    const cleanTitle = newTitle.trim();

    const exists = columns.some(
        item =>
            item.id !== id &&
            item.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (exists) {
        showToast("Nama kolom sudah digunakan!");
        return;
    }

    column.title = cleanTitle.toUpperCase();

    saveColumns();
    renderBoard();

    showToast("Nama kolom berhasil diubah!");
}


// 22. HAPUS KOLOM

function deleteColumn(id) {
    if (columns.length <= 1) {
        showToast("Minimal harus ada satu kolom!");
        return;
    }

    const column = columns.find(
        item => item.id === id
    );

    if (!column) return;

    const confirmation = confirm(
        `Hapus kolom ${column.title}? Tugas di dalamnya akan dipindahkan ke kolom Backlog atau kolom pertama yang tersedia.`
    );

    if (!confirmation) return;

    const remainingColumns = columns.filter(
        item => item.id !== id
    );

    const destination =
        remainingColumns.find(item => item.id === "backlog") ||
        remainingColumns[0];

    tasks.forEach(task => {
        if (task.status === id) {
            task.status = destination.id;
        }
    });

    columns = remainingColumns;

    saveColumns();
    saveTasks();
    renderBoard();

    showToast("Kolom berhasil dihapus!");
}


// 23. MENJALANKAN WEBSITE

loadTheme();
renderBoard();
