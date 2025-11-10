fetch('/dashboard/api/karyawan-count')
    .then(res => res.json())
    .then(data => {
        document.getElementById('totalKaryawan').textContent = data.total || 0;
    })
    .catch(() => {
        document.getElementById('totalKaryawan').textContent = '0';
    });
fetch('/dashboard/api/kategori-count')
    .then(res => res.json())
    .then(data => {
        document.getElementById('totalKategori').textContent = data.total || 0;
    })
    .catch(() => {
        document.getElementById('totalKategori').textContent = '0';
    });
fetch('/dashboard/api/recent-activities')
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('activityLog');
        if (data.activities && data.activities.length > 0) {
            container.innerHTML = data.activities.map(act => `
        <div class="d-flex gap-3 mb-3 pb-3" style="border-bottom: 1px solid #e3e6f0;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fas ${getActivityIcon(act.jenis_aktivitas)}" style="color: #858796;"></i>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 0.85rem; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">
              ${act.jenis_aktivitas}
            </div>
            <div style="font-size: 0.75rem; color: #858796;">
              ${act.detail_perubahan || 'Tidak ada detail'}
            </div>
            <div style="font-size: 0.8rem; color: #b7b9cc; margin-top: 4px;">
              ${formatTime(act.timestamp)}
            </div>
          </div>
        </div>
      `).join('');
        } else {
            container.innerHTML = '<div class="text-center text-muted py-4">Tidak ada aktivitas</div>';
        }
    })
    .catch(() => {
        document.getElementById('activityLog').innerHTML = '<div class="text-center text-danger py-4">Gagal memuat data</div>';
    });
fetch('/dashboard/api/top-kategori')
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('topKategori');
        if (data.categories && data.categories.length > 0) {
            container.innerHTML = data.categories.map((cat, idx) => `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="d-flex align-items-center gap-2">
            <span style="width: 24px; height: 24px; border-radius: 50%; background: ${['#858796', '#1cc88a', '#36b9cc'][idx]}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
              ${idx + 1}
            </span>
            <span style="font-size: 0.85rem; color: #5a5c69; font-weight: 600;">${cat.kategori}</span>
          </div>
          <span style="font-size: 0.85rem; color: #858796; font-weight: 700;">${cat.total}</span>
        </div>
      `).join('');
        } else {
            container.innerHTML = '<div class="text-center text-muted">Tidak ada data</div>';
        }
    })
    .catch(() => {
        document.getElementById('topKategori').innerHTML = '<div class="text-center text-danger">Gagal memuat</div>';
    });
fetch('/dashboard/api/lelang-berakhir')
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('lelangBerakhir');
        if (data.auctions && data.auctions.length > 0) {
            container.innerHTML = data.auctions.map(auction => `
        <div class="mb-3 pb-3" style="border-bottom: 1px solid #e3e6f0;">
          <div style="font-size: 0.85rem; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">
            ${auction.nama_barang}
          </div>
          <div style="font-size: 0.75rem; color: #e74a3b;">
            <i class="fas fa-clock me-1"></i>${formatTimeLeft(auction.waktu_selesai)}
          </div>
        </div>
      `).join('');
        } else {
            container.innerHTML = '<div class="text-center text-muted">Tidak ada lelang aktif</div>';
        }
    })
    .catch(() => {
        document.getElementById('lelangBerakhir').innerHTML = '<div class="text-center text-danger">Gagal memuat</div>';
    });

function getActivityIcon(type) {
    const icons = {
        'Tambah Barang': 'fa-plus-circle',
        'Edit Barang': 'fa-edit',
        'Hapus Barang': 'fa-trash',
        'Lelang Dibuat': 'fa-gavel',
        'Lelang Selesai': 'fa-check-circle'
    };
    return icons[type] || 'fa-info-circle';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    return Math.floor(diff / 86400) + ' hari lalu';
}

function formatTimeLeft(endTime) {
    const end = new Date(endTime);
    const now = new Date();
    const diff = Math.floor((end - now) / 1000);

    if (diff < 0) return 'Sudah berakhir';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lagi';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lagi';
    return Math.floor(diff / 86400) + ' hari lagi';
}