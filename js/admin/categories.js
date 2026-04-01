// js/admin/categories.js

const AdminCategories = {
    allCategories: [],
    editingId: null,

    async init() {
        if (!AdminAuth.requireAuth()) return;
        await this.loadCategories();
    },

    async loadCategories() {
        const container = document.getElementById('categoriesContent');
        if (!container) return;

        container.innerHTML = `<div class="page-loader"><div class="loading-spinner"></div></div>`;

        const { data, error } = await DB.getAllCategories();

        if (error) {
            container.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><button class="btn btn-primary" onclick="AdminCategories.loadCategories()">Retry</button></div>`;
            return;
        }

        this.allCategories = data || [];
        this.populateParentDropdown();
        this.renderCategories();
    },

    populateParentDropdown() {
        const select = document.getElementById('catParent');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">None (Main Category)</option>';

        const parents = this.allCategories.filter(c => !c.parent_id);
        parents.forEach(c => {
            // Don't allow setting self as parent
            if (c.id !== this.editingId) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });

        if (currentVal) select.value = currentVal;
    },

    renderCategories() {
        const container = document.getElementById('categoriesContent');
        if (!container) return;

        if (this.allCategories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <h3>No categories yet</h3>
                    <p>Create your first category to organize products</p>
                    <button class="btn btn-primary" onclick="AdminCategories.showForm()">+ Add Category</button>
                </div>
            `;
            return;
        }

        // Organize: parents first, then children grouped
        const parents = this.allCategories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);

        let rows = [];
        parents.forEach(parent => {
            rows.push(parent);
            const children = this.allCategories
                .filter(c => c.parent_id === parent.id)
                .sort((a, b) => a.sort_order - b.sort_order);
            rows.push(...children);
        });

        // Add orphan subcategories (parent deleted)
        const orphans = this.allCategories.filter(c =>
            c.parent_id && !this.allCategories.find(p => p.id === c.parent_id)
        );
        rows.push(...orphans);

        container.innerHTML = `
            <p class="text-muted mb-2" style="font-size:13px;">${this.allCategories.length} categories total</p>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Products</th>
                            <th>Status</th>
                            <th>Sort Order</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(c => this.renderCategoryRow(c)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderCategoryRow(cat) {
        const parentName = cat.parent_id
            ? this.allCategories.find(p => p.id === cat.parent_id)?.name
            : null;

        return `
            <tr style="${cat.parent_id ? 'background:var(--gray-50);' : ''}">
                <td>
                    <div class="product-cell">
                        ${cat.image_url ? `
                            <div class="thumb" style="border-radius:50%;">
                                <img src="${cat.image_url}" alt="" onerror="this.src='${placeholderImage(cat.name)}'">
                            </div>
                        ` : `
                            <div class="thumb" style="border-radius:50%;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-size:16px;">
                                ${cat.parent_id ? '📁' : '📂'}
                            </div>
                        `}
                        <div>
                            <strong>${cat.parent_id ? '↳ ' : ''}${cat.name}</strong>
                            ${cat.description ? `<br><small class="text-muted">${cat.description.substring(0, 50)}${cat.description.length > 50 ? '...' : ''}</small>` : ''}
                            ${parentName ? `<br><small class="text-muted">Parent: ${parentName}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="tag ${cat.parent_id ? 'tag-info' : 'tag-primary'}">
                        ${cat.parent_id ? 'Sub-category' : 'Main'}
                    </span>
                </td>
                <td>-</td>
                <td>
                    <span class="tag ${cat.is_active ? 'tag-success' : 'tag-danger'}">
                        ${cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${cat.sort_order}</td>
                <td>
                    <div class="actions">
                        <button class="edit-btn" onclick="AdminCategories.editCategory('${cat.id}')">Edit</button>
                        <button class="delete-btn" onclick="AdminCategories.deleteCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    },

    showForm(categoryData = null) {
        this.editingId = categoryData?.id || null;

        document.getElementById('catFormTitle').textContent =
            categoryData ? 'Edit Category' : 'Add Category';

        document.getElementById('catName').value = categoryData?.name || '';
        document.getElementById('catDescription').value = categoryData?.description || '';
        document.getElementById('catImage').value = categoryData?.image_url || '';
        document.getElementById('catSort').value = categoryData?.sort_order || 0;
        document.getElementById('catActive').checked = categoryData?.is_active !== false;

        this.populateParentDropdown();

        // Set parent after populating
        setTimeout(() => {
            document.getElementById('catParent').value = categoryData?.parent_id || '';
        }, 50);

        document.getElementById('categoryModal').classList.add('active');
        document.getElementById('catName').focus();
    },

    hideForm() {
        document.getElementById('categoryModal').classList.remove('active');
        this.editingId = null;
    },

    editCategory(id) {
        const cat = this.allCategories.find(c => c.id === id);
        if (cat) this.showForm(cat);
    },

    async saveCategory(e) {
        e.preventDefault();

        const name = document.getElementById('catName').value.trim();
        if (!name) {
            Toast.error('Category name is required');
            return;
        }

        const catData = {
            name: name,
            parent_id: document.getElementById('catParent').value || null,
            description: document.getElementById('catDescription').value.trim() || null,
            image_url: document.getElementById('catImage').value.trim() || null,
            sort_order: parseInt(document.getElementById('catSort').value) || 0,
            is_active: document.getElementById('catActive').checked
        };

        let result;
        if (this.editingId) {
            result = await DB.updateCategory(this.editingId, catData);
        } else {
            catData.slug = slugify(name) + '-' + Date.now().toString(36);
            result = await DB.createCategory(catData);
        }

        if (result.error) {
            Toast.error('Failed: ' + result.error.message);
            return;
        }

        Toast.success(this.editingId ? 'Category updated!' : 'Category created!');
        this.hideForm();
        await this.loadCategories();
    },

    async deleteCategory(id, name) {
        // Check for subcategories
        const hasChildren = this.allCategories.some(c => c.parent_id === id);
        if (hasChildren) {
            if (!confirm(`"${name}" has subcategories. Deleting will orphan them. Continue?`)) return;
        } else {
            if (!confirm(`Delete "${name}"?`)) return;
        }

        const { error } = await DB.deleteCategory(id);
        if (error) {
            Toast.error('Failed: ' + error.message);
            return;
        }

        Toast.success('Category deleted');
        await this.loadCategories();
    }
};

document.addEventListener('DOMContentLoaded', () => AdminCategories.init());
