let cart = {}; 
let products = []; 
let currentFilter = 'default'; 

// ТВОЯ ССЫЛКА (Оставляем как есть)
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTVnxKRcyYW7dUgLPUfllmyyp-cl8Ta5_ZKrLk4Yci1F5eNpygT08Hi-fNc_-MwGihzzTmLpZLuKg9X/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
    loadCartFromStorage();
    loadProductsFromGoogle(); 
    updateCartIcon();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.log);
}

// === ЗАГРУЗКА ДАННЫХ ===
function loadProductsFromGoogle() {
    Papa.parse(GOOGLE_SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Отладка: смотрим в консоли, какие пришли заголовки
            if (results.data.length > 0) {
                console.log("Заголовки из таблицы:", Object.keys(results.data[0]));
            }

            products = results.data
                .filter(item => item.name && item.price) // Убираем пустые
                .map(item => ({
                    id: item.id,
                    name: item.name,
                    // Чистим цену от пробелов и превращаем в число
                    price: Number(String(item.price).replace(/\s/g, '')), 
                    stock: Number(item.stock),
                    unit: item.unit,
                    image: item.image,
                    // ГЛАВНОЕ ИСПРАВЛЕНИЕ:
                    // Если категории нет, пишем "Разное". 
                    // .trim() удаляет случайные пробелы в начале и конце
                    category: item.category ? item.category.trim() : "Разное"
                }));

            console.log("Товары загружены:", products);
            
            generateFilterMenu(); // Создаем меню
            renderProducts();     // Рисуем товары
            
            // Обновляем корзину, если она открыта
            if (!document.getElementById('cart-view').classList.contains('hidden')) {
                renderCartItems();
            }

            updateCartIcon(); // Пересчитываем сумму для плашки, когда цены загрузились
        },
        error: function(err) {
            console.error("Ошибка загрузки CSV:", err);
            alert("Ошибка загрузки данных. Проверьте консоль.");
        }
    });
}

// === Генерация меню фильтров ===
function generateFilterMenu() {
    const dropdown = document.getElementById('filter-dropdown');
    dropdown.innerHTML = ''; 

    // 1. Собираем уникальные категории и сортируем их
    const categories = [...new Set(products.map(p => p.category))].sort();

    // 2. Стандартные кнопки сортировки
    const staticOptions = [
        { name: 'Все товары', val: 'default', icon: 'fas fa-list' }, // Добавил кнопку сброса в начало
        { name: 'Сначала дешевые', val: 'price-asc', icon: 'fas fa-sort-amount-down-alt' },
        { name: 'Сначала дорогие', val: 'price-desc', icon: 'fas fa-sort-amount-up' }
    ];

    staticOptions.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `<span>${opt.name}</span> <i class="${opt.icon}"></i>`;
        item.onclick = () => applyFilter(opt.val, opt.name);
        dropdown.appendChild(item);
    });

    // Разделитель
    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    dropdown.appendChild(divider);

    // 3. Категории из базы
    categories.forEach(cat => {
        if (!cat) return;
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerText = cat;
        // При клике передаем название категории как фильтр
        item.onclick = () => applyFilter(cat, cat); 
        dropdown.appendChild(item);
    });
}

// Открыть/Закрыть меню
function toggleFilterMenu() {
    const dropdown = document.getElementById('filter-dropdown');
    const arrow = document.getElementById('filter-arrow');
    dropdown.classList.toggle('hidden');
    
    if(dropdown.classList.contains('hidden')) {
        arrow.className = 'fas fa-chevron-down';
    } else {
        arrow.className = 'fas fa-chevron-up';
    }
}

// Применить фильтр
function applyFilter(value, name) {
    console.log("Выбран фильтр:", value); // Для проверки
    currentFilter = value;
    
    document.getElementById('current-filter-name').innerText = name;
    
    // Если выбрали "Все товары" (default), прячем кнопку сброса
    if (value === 'default') {
        document.getElementById('filter-reset-btn').classList.add('hidden');
    } else {
        document.getElementById('filter-reset-btn').classList.remove('hidden');
    }
    
    toggleFilterMenu(); // Закрываем меню
    renderProducts();   // Перерисовываем
}

// === ИСПРАВЛЕННАЯ ФУНКЦИЯ СБРОСА ===
function resetFilters() {
    // 1. Сбрасываем переменную фильтра
    currentFilter = 'default';
    
    // 2. Возвращаем название кнопки
    document.getElementById('current-filter-name').innerText = 'Фильтры';
    
    // 3. Прячем кнопку крестика
    document.getElementById('filter-reset-btn').classList.add('hidden');
    
    // 4. ПРИНУДИТЕЛЬНО ЗАКРЫВАЕМ МЕНЮ (чтобы оно не выпадало)
    const dropdown = document.getElementById('filter-dropdown');
    const arrow = document.getElementById('filter-arrow');
    
    dropdown.classList.add('hidden'); // Добавляем класс скрытия
    arrow.className = 'fas fa-chevron-down'; // Стрелочку вниз
    
    // 5. Перерисовываем товары
    renderProducts();
}

// === ОТРИСОВКА ТОВАРОВ ===
function renderProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    container.innerHTML = ''; 
    
    if (products.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%;">Загрузка товаров...</p>';
        return;
    }

    let sortedProducts = [...products];

    // Логика фильтрации
    if (currentFilter === 'price-asc') {
        sortedProducts.sort((a, b) => a.price - b.price);
    } else if (currentFilter === 'price-desc') {
        sortedProducts.sort((a, b) => b.price - a.price);
    } else if (currentFilter !== 'default') {
        // Умное сравнение: убираем пробелы и приводим к строке
        sortedProducts = sortedProducts.filter(p => p.category === currentFilter);
    }

    // Если ничего не найдено
    if (sortedProducts.length === 0) {
        container.innerHTML = '<div style="text-align:center; width:100%; padding:20px; color:#777">В этой категории пока нет товаров</div>';
        return;
    }

    sortedProducts.forEach(product => {
        const qty = cart[product.id] || 0;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-img" onerror="this.src='img/no-photo.png'">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-meta">Цена за ${product.unit}</p>
                <div class="price-row">
                    <span class="price">${formatPrice(product.price)}</span>
                    ${qty === 0 ? `
                        <button class="add-btn" onclick="addToCart('${product.id}')"><i class="fas fa-plus"></i></button>
                    ` : `
                        <div class="quantity-controls" style="display: flex;">
                            <button class="qty-btn" onclick="changeQty('${product.id}', -1)">-</button>
                            <span class="qty-val">${qty}</span>
                            <button class="qty-btn" onclick="changeQty('${product.id}', 1)">+</button>
                        </div>
                    `}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// === Остальные функции (без изменений) ===

function addToCart(id) {
    if (!cart[id]) cart[id] = 1;
    saveCart();
    renderProducts();
    updateCartIcon();
    checkOrderButton();
}

function changeQty(id, change) {
    if (cart[id]) {
        cart[id] += change;
        if (cart[id] <= 0) delete cart[id];
    }
    saveCart();
    
    if (document.getElementById('catalog-view').classList.contains('hidden')) {
        renderCartItems();
    } else {
        renderProducts();
    }
    updateCartIcon();
    checkOrderButton();
}

// Функция для полного удаления товара из корзины
function removeFromCart(id) {
    // Удаляем товар из объекта корзины
    delete cart[id]; 
    
    // Сохраняем изменения и обновляем интерфейс
    saveCart();
    renderCartItems(); 
    updateCartIcon();
    checkOrderButton();
}

function saveCart() { localStorage.setItem('shopCart', JSON.stringify(cart)); }
function loadCartFromStorage() { const saved = localStorage.getItem('shopCart'); if (saved) cart = JSON.parse(saved); }

function updateCartIcon() {
    const badge = document.getElementById('cart-badge');
    const floatingBanner = document.getElementById('floating-cart-banner');
    const bannerQty = document.getElementById('banner-qty');
    const bannerTotal = document.getElementById('banner-total');

    let totalQty = 0;
    let totalPrice = 0;

    // Считаем общее количество и сумму
    for (const [id, qty] of Object.entries(cart)) {
        totalQty += qty;
        // Находим товар, чтобы узнать его цену
        const product = products.find(p => p.id == id);
        if (product) {
            totalPrice += product.price * qty;
        }
    }

    // 1. Обновляем кружочек (бейджик) в нижнем меню
    if (totalQty > 0) {
        badge.classList.remove('hidden');
        badge.innerText = totalQty;
    } else {
        badge.classList.add('hidden');
    }

    // 2. Логика плавающей плашки
    const catalogView = document.getElementById('catalog-view');
    // Показываем плашку только если есть товары И мы находимся в каталоге
    if (totalQty > 0 && catalogView && !catalogView.classList.contains('hidden')) {
        if (floatingBanner) {
            floatingBanner.classList.remove('hidden');
            bannerQty.innerText = totalQty;
            bannerTotal.innerText = formatPrice(totalPrice);
        }
    } else {
        // Прячем, если корзина пуста или мы уже внутри корзины
        if (floatingBanner) {
            floatingBanner.classList.add('hidden');
        }
    }
}

function formatPrice(price) { return price.toLocaleString('ru-RU') + ' ₸'; }

function switchTab(tabName) {
    const catalogView = document.getElementById('catalog-view');
    const cartView = document.getElementById('cart-view');
    const tabCatalog = document.getElementById('tab-catalog');
    const tabCart = document.getElementById('tab-cart');

    if (tabName === 'catalog') {
        catalogView.classList.remove('hidden');
        cartView.classList.add('hidden');
        tabCatalog.classList.add('active');
        tabCart.classList.remove('active');
        renderProducts(); 
    } else {
        catalogView.classList.add('hidden');
        cartView.classList.remove('hidden');
        tabCatalog.classList.remove('active');
        tabCart.classList.add('active');
        renderCartItems(); 
        checkOrderButton();
    }
    updateCartIcon();
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('cart-total-price');
    container.innerHTML = '';
    let totalSum = 0;
    let isEmpty = true;

    for (const [id, qty] of Object.entries(cart)) {
        const product = products.find(p => p.id == id);
        if (product) {
            isEmpty = false;
            const itemSum = product.price * qty;
            totalSum += itemSum;

            const item = document.createElement('div');
            item.className = 'cart-item';
            item.innerHTML = `
                <div class="cart-item-info">
                    <h4>${product.name}</h4>
                    <p>${formatPrice(product.price)} / ${product.unit}</p>
                </div>
                <div class="cart-right">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-bottom: 8px;">
                        <span class="cart-item-total">${formatPrice(itemSum)}</span>
                        <button class="remove-item-btn" onclick="removeFromCart('${product.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="quantity-controls" style="display: flex;">
                        <button class="qty-btn" onclick="changeQty('${product.id}', -1)">-</button>
                        <span class="qty-val">${qty}</span>
                        <button class="qty-btn" onclick="changeQty('${product.id}', 1)">+</button>
                    </div>
                </div>
            `;
            container.appendChild(item);
        }
    }
    totalPriceEl.innerText = formatPrice(totalSum);
    if (isEmpty) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #999;">Корзина пуста 😔<br>Перейдите в каталог</div>';
    }
    checkOrderButton();
}

function checkOrderButton() {
    const addressInput = document.getElementById('delivery-address');
    const orderBtn = document.getElementById('order-btn');
    if (!addressInput || !orderBtn) return;
    const hasAddress = addressInput.value.trim().length > 0;
    const isCartEmpty = Object.keys(cart).length === 0;
    if (hasAddress && !isCartEmpty) { orderBtn.disabled = false; } else { orderBtn.disabled = true; }
}

function sendToWhatsapp() {
    const address = document.getElementById('delivery-address').value;
    const cartItems = [];
    let totalPrice = 0;
    for (const [id, qty] of Object.entries(cart)) {
        const product = products.find(p => p.id == id);
        if (product) {
            const sum = product.price * qty;
            totalPrice += sum;
            cartItems.push(`${product.name} x${qty} - ${sum}тг`);
        }
    }
    const message = `
📦 *Новый заказ!*
📍 *Адрес:* ${address}
------------------
${cartItems.join('\n')}
------------------
💰 *Итого: ${formatPrice(totalPrice)}*
`;
    const encodedMessage = encodeURIComponent(message);
    const phone = "77085708371"; 
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
}

document.getElementById('search-input')?.addEventListener('input', (e) => {
    if (document.getElementById('catalog-view').classList.contains('hidden')) { switchTab('catalog'); }
    const query = e.target.value.toLowerCase();
    const allCards = document.querySelectorAll('.product-card');
    allCards.forEach(card => {
        const name = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = name.includes(query) ? 'flex' : 'none';
    });
});
