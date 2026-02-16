let cart = {}; 

document.addEventListener('DOMContentLoaded', () => {
    loadCartFromStorage();
    renderProducts(); 
    updateCartIcon();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker зарегистрирован"))
    .catch((err) => console.log("Ошибка SW:", err));
}


// === 1. Отрисовка товаров в каталоге ===
function renderProducts(filterType = 'default') {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    container.innerHTML = ''; 
    let sortedProducts = [...products];

    // Фильтрация (оставил как было)
    if (filterType === 'price-asc') sortedProducts.sort((a, b) => a.price - b.price);
    if (filterType === 'category-moloko') sortedProducts = sortedProducts.filter(p => p.category === 'Молочные продукты');
    if (filterType === 'category-bread') sortedProducts = sortedProducts.filter(p => p.category === 'Выпечка');

    sortedProducts.forEach(product => {
        const qty = cart[product.id] || 0;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-img">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-meta">Остаток: ${product.stock} ${product.unit}</p>
                <div class="price-row">
                    <span class="price">${formatPrice(product.price)}</span>
                    ${qty === 0 ? `
                        <button class="add-btn" onclick="addToCart(${product.id})"><i class="fas fa-plus"></i></button>
                    ` : `
                        <div class="quantity-controls" style="display: flex;">
                            <button class="qty-btn" onclick="changeQty(${product.id}, -1)">-</button>
                            <span class="qty-val">${qty}</span>
                            <button class="qty-btn" onclick="changeQty(${product.id}, 1)">+</button>
                        </div>
                    `}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// === 2. Логика добавления ===
function addToCart(id) {
    if (!cart[id]) cart[id] = 1;
    saveCart();
    renderProducts();
    updateCartIcon();
}

function changeQty(id, change) {
    if (cart[id]) {
        cart[id] += change;
        if (cart[id] <= 0) delete cart[id];
    }
    saveCart();
    
    // Если мы в каталоге - обновляем каталог, если в корзине - обновляем корзину
    if (document.getElementById('catalog-view').classList.contains('hidden')) {
        renderCartItems(); // Обновляем вид корзины
    } else {
        renderProducts(); // Обновляем вид каталога
    }
    updateCartIcon();
}

function saveCart() {
    localStorage.setItem('shopCart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('shopCart');
    if (saved) cart = JSON.parse(saved);
}

function updateCartIcon() {
    const badge = document.getElementById('cart-badge');
    let totalQty = 0;
    Object.values(cart).forEach(qty => totalQty += qty);
    if (totalQty > 0) {
        badge.classList.remove('hidden');
        badge.innerText = totalQty;
    } else {
        badge.classList.add('hidden');
    }
}

function formatPrice(price) {
    return price.toLocaleString('ru-RU') + ' ₸';
}

// === 3. Переключение вкладок (Каталог / Корзина) ===
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
        renderProducts(); // Обновляем каталог при возврате
    } else {
        catalogView.classList.add('hidden');
        cartView.classList.remove('hidden');
        tabCatalog.classList.remove('active');
        tabCart.classList.add('active');
        renderCartItems(); // Рисуем содержимое корзины
    }
}

// === 4. Отрисовка страницы КОРЗИНЫ (Обновленная версия) ===
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
            
            // Вставляем структуру с кнопками +/-
            item.innerHTML = `
                <div class="cart-item-info">
                    <h4>${product.name}</h4>
                    <p>${formatPrice(product.price)} / шт.</p>
                </div>
                
                <div class="cart-right">
                    <span class="cart-item-total">${formatPrice(itemSum)}</span>
                    
                    <div class="quantity-controls" style="display: flex;">
                        <button class="qty-btn" onclick="changeQty(${product.id}, -1)">-</button>
                        <span class="qty-val">${qty}</span>
                        <button class="qty-btn" onclick="changeQty(${product.id}, 1)">+</button>
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
}

// === 5. Отправка в WhatsApp ===
function sendToWhatsapp() {
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

    if (cartItems.length === 0) {
        alert("Сначала добавьте товары!");
        return;
    }

    const message = `
📦 *Новый заказ!*
------------------
${cartItems.join('\n')}
------------------
💰 *Итого: ${formatPrice(totalPrice)}*
`;

    const encodedMessage = encodeURIComponent(message);
    const phone = "77009884710"; 
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
}

// Поиск (оставил без изменений)
document.getElementById('search-input')?.addEventListener('input', (e) => {
    // Если мы в корзине, переключаем на каталог при поиске
    if (document.getElementById('catalog-view').classList.contains('hidden')) {
        switchTab('catalog');
    }
    
    const query = e.target.value.toLowerCase();
    const allCards = document.querySelectorAll('.product-card');
    allCards.forEach(card => {
        const name = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// === 6. Логика кнопок фильтров (Добавить в конец файла script.js) ===
document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        // 1. Убираем активный класс (зеленый цвет) у всех кнопок
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        
        // 2. Делаем активной нажатую кнопку
        btn.classList.add('active');
        
        // 3. Получаем тип фильтра из HTML (data-sort="...")
        const sortType = btn.getAttribute('data-sort');
        
        // 4. Перерисовываем товары с учетом фильтра
        renderProducts(sortType);
    });

});
