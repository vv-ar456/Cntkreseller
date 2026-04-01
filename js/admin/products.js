// js/admin/products.js

const AdminProducts = {
    allProducts: [],
    allCategories: [],
    editingId: null,
    currentPage: 1,
    perPage: 20,
    searchTerm: '',
    filterCategory: '',
    filterStatus: '',

    async init() {
        if (!AdminAuth.requireAuth()) return;
        await this.loadCategories();
        await this.loadProducts();
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Category change → populate subcategories
        const catSelect = document.getElementById('pCategory');
        if (catSelect) {
            catSelect.addEventListener('change', () => {
                this.populateSubcategories(catSelect.value);
            });
        }

        // Image URL preview
        const thumbnailInput = document.getElementById('pThumbnail');
        if (thumbnailInput) {
            thumbnailInput.addEventListener('change', () => {
                this.updateImagePreview();
            });
        }

        // Search with debounce
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchTerm = searchInput.value.trim().toLowerCase();
                    this.currentPage = 1;
                    this.renderProducts();
                }, 300);
            });
        }

        // Category filter
        const catFilter = document.getElementById('categoryFilter');
        if (catFilter) {
            catFilter.addEventListener('change', () => {
                this.filterCategory = catFilter.value;
                this.currentPage = 1;
                this.renderProducts();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilterProd');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filterStatus = statusFilter.value;
                this.currentPage = 1;
                this.renderProducts();
            });
        }
    },

    async loadCategories() {
        const { data } = await DB.getAllCategories();
        this.allCategories = data || [];

        // Populate filter dropdown
        const filterSelect = document.getElementById('categoryFilter');
        if (filterSelect) {
            const parents = this.allCategories.filter(c => !c.parent_id);
            parents.forEach(c => {
                filterSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }

        // Populate form dropdown
        this.populateFormCategories();
    },

    populateFormCategories() {
        const catSelect = document.getElementById('pCategory');
        if (!catSelect) return;

        catSelect.innerHTML = '<option value="">Select category</option>';
        const parents = this.allCategories.filter(c => !c.parent_id);
        parents.forEach(c => {
            catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    },

    populateSubcategories(parentId) {
        const subSelect = document.getElementById('pSubCategory');
        if (!subSelect) return;

        subSelect.innerHTML = '<option value="">Select sub-category</option>';
        if (!parentId) return;

        const subs = this.allCategories.filter(c => c.parent_id === parentId);
        subs.forEach(c => {
            subSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    },

    async loadProducts() {
        const container = document.getElementById('productsContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        const { data, error } = await DB.getAllProducts();

        if (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load products</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="AdminProducts.loadProducts()">Retry</button>
                </div>
            `;
            return;
        }

        this.allProducts = data || [];
        this.renderProducts();
    },

    getFilteredProducts() {
        let products = [...this.allProducts];

        // Search filter
        if (this.searchTerm) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(this.searchTerm) ||
                (p.sku && p.sku.toLowerCase().includes(this.searchTerm)) ||
                (p.description && p.description.toLowerCase().includes(this.searchTerm))
            );
        }

        // Category filter
        if (this.filterCategory) {
            products = products.filter(p =>
                p.category_id === this.filterCategory || p.subcategory_id === this.filterCategory
            );
        }

        // Status filter
        if (this.filterStatus === 'active') {
            products = products.filter(p => p.is_active);
        } else if (this.filterStatus === 'inactive') {
            products = products.filter(p => !p.is_active);
        } else if (this.filterStatus === 'featured') {
            products = products.filter(p => p.is_featured);
        } else if (this.filterStatus === 'special') {
            products = products.filter(p => p.is_special);
        } else if (this.filterStatus === 'out_of_stock') {
            products = products.filter(p => p.stock <= 0);
        } else if (this.filterStatus === 'low_stock') {
            products = products.filter(p => p.stock > 0 && p.stock <= 5);
        }

        return products;
    },

    renderProducts() {
        const container = document.getElementById('productsContent');
        if (!container) return;

        const filtered = this.getFilteredProducts();
        const totalPages = Math.ceil(filtered.length / this.perPage);
        const start = (this.currentPage - 1) * this.perPage;
        const paginated = filtered.slice(start, start + this.perPage);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>${this.searchTerm || this.filterCategory || this.filterStatus ? 'No matching products' : 'No products yet'}</h3>
                    <p>${this.searchTerm ? 'Try different search terms' : 'Add your first product to get started'}</p>
                    ${!this.searchTerm ? '<button class="btn btn-primary" onclick="AdminProducts.showForm()">+ Add Product</button>' : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <p class="text-muted mb-2" style="font-size:13px;">
                Showing ${start + 1}–${Math.min(start + this.perPage, filtered.length)} of ${filtered.length} products
            </p>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>MRP</th>
                            <th>Base Price</th>
                            <th>Max Margin</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginated.map(p => this.renderProductRow(p)).join('')}
                    </tbody>
                </table>
            </div>
            ${totalPages > 1 ? this.renderPagination(totalPages) : ''}
        `;
    },

    renderProductRow(p) {
        const maxMargin = (parseFloat(p.mrp) - parseFloat(p.base_price)).toFixed(2);
        const categoryName = p.categories?.name || '-';

        let stockClass = '';
        let stockLabel = '';
        if (p.stock <= 0) {
            stockClass = 'tag-danger';
            stockLabel = 'Out';
        } else if (p.stock <= 5) {
            stockClass = 'tag-warning';
            stockLabel = p.stock;
        } else {
            stockClass = 'tag-success';
            stockLabel = p.stock;
        }

        return `
            <tr>
                <td>
                    <div class="product-cell">
                        <div class="thumb">
                            <img src="${p.thumbnail || placeholderImage('')}" alt="" onerror="this.src='${placeholderImage('')}'">
                        </div>
                        <div>
                            <strong style="font-size:13px;">${p.name}</strong>
                            <br>
                            <small class="text-muted">
                                ${p.sku ? `SKU: ${p.sku}` : 'No SKU'}
                                ${p.is_featured ? ' ⭐' : ''}
                                ${p.is_special ? ' 🔥' : ''}
                            </small>
                        </div>
                    </div>
                </td>
                <td><span class="tag tag-info">${categoryName}</span></td>
                <td><strong>${formatCurrency(p.mrp)}</strong></td>
                <td>${formatCurrency(p.base_price)}</td>
                <td><span class="text-success fw-600">${formatCurrency(maxMargin)}</span></td>
                <td><span class="tag ${stockClass}">${stockLabel}</span></td>
                <td>
                    <span class="tag ${p.is_active ? 'tag-success' : 'tag-danger'}">
                        ${p.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="actions">
                        <button class="edit-btn" onclick="AdminProducts.editProduct('${p.id}')">Edit</button>
                        <button class="view-btn" onclick="AdminProducts.duplicateProduct('${p.id}')">Copy</button>
                        <button class="delete-btn" onclick="AdminProducts.deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    },

    renderPagination(totalPages) {
        let html = '<div class="pagination">';

        html += `<button ${this.currentPage === 1 ? 'disabled' : ''} 
                         onclick="AdminProducts.goToPage(${this.currentPage - 1})">‹</button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="${i === this.currentPage ? 'active' : ''}" 
                                 onclick="AdminProducts.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += '<button disabled>...</button>';
            }
        }

        html += `<button ${this.currentPage === totalPages ? 'disabled' : ''} 
                         onclick="AdminProducts.goToPage(${this.currentPage + 1})">›</button>`;

        html += '</div>';
        return html;
    },

    goToPage(page) {
        this.currentPage = page;
        this.renderProducts();
        window.scrollTo({ top: 200, behavior: 'smooth' });
    },

    showForm(productData = null) {
        this.editingId = productData?.id || null;

        document.getElementById('productFormTitle').textContent =
            productData ? 'Edit Product' : 'Add New Product';

        const form = document.getElementById('productForm');
        form.reset();

        if (productData) {
            document.getElementById('pName').value = productData.name || '';
            document.getElementById('pSku').value = productData.sku || '';
            document.getElementById('pMrp').value = productData.mrp || '';
            document.getElementById('pBasePrice').value = productData.base_price || '';
            document.getElementById('pStock').value = productData.stock || 0;
            document.getElementById('pWeight').value = productData.weight_grams || 0;
            document.getElementById('pDescription').value = productData.description || '';
            document.getElementById('pThumbnail').value = productData.thumbnail || '';
            document.getElementById('pImages').value = (productData.images || []).join('\n');
            document.getElementById('pTags').value = (productData.tags || []).join(', ');
            document.getElementById('pFeatured').checked = productData.is_featured;
            document.getElementById('pSpecial').checked = productData.is_special;
            document.getElementById('pActive').checked = productData.is_active;

            // Set category
            document.getElementById('pCategory').value = productData.category_id || '';
            this.populateSubcategories(productData.category_id);

            setTimeout(() => {
                document.getElementById('pSubCategory').value = productData.subcategory_id || '';
            }, 100);
        } else {
            document.getElementById('pActive').checked = true;
        }

        this.updateImagePreview();
        document.getElementById('productModal').classList.add('active');
        document.getElementById('pName').focus();
    },

    hideForm() {
        document.getElementById('productModal').classList.remove('active');
        this.editingId = null;
    },

    editProduct(id) {
        const product = this.allProducts.find(p => p.id === id);
        if (product) {
            this.showForm(product);
        }
    },

    async duplicateProduct(id) {
        const product = this.allProducts.find(p => p.id === id);
        if (!product) return;

        const duplicate = { ...product };
        delete duplicate.id;
        delete duplicate.created_at;
        delete duplicate.updated_at;
        duplicate.name = product.name + ' (Copy)';
        duplicate.slug = slugify(duplicate.name) + '-' + Date.now().toString(36);
        duplicate.sku = product.sku ? product.sku + '-COPY' : null;

        this.showForm(duplicate);
        this.editingId = null; // Force create mode
    },

    updateImagePreview() {
        const thumbnail = document.getElementById('pThumbnail')?.value;
        const previewContainer = document.getElementById('imagePreview');
        if (!previewContainer) return;

        const imagesText = document.getElementById('pImages')?.value || '';
        const imageUrls = [thumbnail, ...imagesText.split('\n')].filter(Boolean).map(s => s.trim()).filter(Boolean);

        if (imageUrls.length === 0) {
            previewContainer.innerHTML = '<p class="text-muted" style="font-size:13px;">No images added</p>';
            return;
        }

        previewContainer.innerHTML = `
            <div class="image-preview-grid">
                ${imageUrls.map((url, i) => `
                    <div class="image-preview-item">
                        <img src="${url}" alt="Preview ${i + 1}" onerror="this.src='${placeholderImage('Error')}'">
                        ${i === 0 ? '<span style="position:absolute;bottom:2px;left:2px;font-size:9px;background:var(--primary);color:white;padding:1px 4px;border-radius:3px;">Thumb</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    async saveProduct(e) {
        e.preventDefault();

        const name = document.getElementById('pName').value.trim();
        const mrp = parseFloat(document.getElementById('pMrp').value);
        const basePrice = parseFloat(document.getElementById('pBasePrice').value);

        // Validation
        if (!name) {
            Toast.error('Product name is required');
            return;
        }
        if (isNaN(mrp) || mrp <= 0) {
            Toast.error('Valid MRP is required');
            return;
        }
        if (isNaN(basePrice) || basePrice <= 0) {
            Toast.error('Valid base price is required');
            return;
        }
        if (basePrice > mrp) {
            Toast.error('Base price cannot be greater than MRP');
            return;
        }

        const imagesText = document.getElementById('pImages').value;
        const tagsText = document.getElementById('pTags').value;

        const productData = {
            name: name,
            sku: document.getElementById('pSku').value.trim() || null,
            mrp: mrp,
            base_price: basePrice,
            category_id: document.getElementById('pCategory').value || null,
            subcategory_id: document.getElementById('pSubCategory').value || null,
            stock: parseInt(document.getElementById('pStock').value) || 0,
            weight_grams: parseInt(document.getElementById('pWeight').value) || 0,
            description: document.getElementById('pDescription').value.trim(),
            thumbnail: document.getElementById('pThumbnail').value.trim() || null,
            images: imagesText.split('\n').map(s => s.trim()).filter(Boolean),
            tags: tagsText.split(',').map(s => s.trim()).filter(Boolean),
            is_featured: document.getElementById('pFeatured').checked,
            is_special: document.getElementById('pSpecial').checked,
            is_active: document.getElementById('pActive').checked
        };

        const btn = document.getElementById('saveProductBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner sm"></span> Saving...';

        let result;

        if (this.editingId) {
            result = await DB.updateProduct(this.editingId, productData);
        } else {
            productData.slug = slugify(name) + '-' + Date.now().toString(36);
            result = await DB.createProduct(productData);
        }

        if (result.error) {
            Toast.error('Failed to save: ' + result.error.message);
            btn.disabled = false;
            btn.textContent = 'Save Product';
            return;
        }

        Toast.success(this.editingId ? 'Product updated!' : 'Product created!');
        this.hideForm();
        await this.loadProducts();

        btn.disabled = false;
        btn.textContent = 'Save Product';
    },

    async deleteProduct(id, name) {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

        const { error } = await DB.deleteProduct(id);
        if (error) {
            Toast.error('Failed to delete: ' + error.message);
            return;
        }

        Toast.success('Product deleted');
        this.allProducts = this.allProducts.filter(p => p.id !== id);
        this.renderProducts();
    },

    async toggleActive(id, currentState) {
        const { error } = await DB.updateProduct(id, { is_active: !currentState });
        if (error) {
            Toast.error('Failed to update');
            return;
        }

        const product = this.allProducts.find(p => p.id === id);
        if (product) product.is_active = !currentState;
        this.renderProducts();
        Toast.success(`Product ${!currentState ? 'activated' : 'deactivated'}`);
    },

    async bulkUpdateStock(id) {
        const newStock = prompt('Enter new stock quantity:');
        if (newStock === null) return;

        const stock = parseInt(newStock);
        if (isNaN(stock) || stock < 0) {
            Toast.error('Invalid stock quantity');
            return;
        }

        const { error } = await DB.updateProduct(id, { stock });
        if (error) {
            Toast.error('Failed to update stock');
            return;
        }

        const product = this.allProducts.find(p => p.id === id);
        if (product) product.stock = stock;
        this.renderProducts();
        Toast.success('Stock updated');
    }
};

document.addEventListener('DOMContentLoaded', () => AdminProducts.init());
