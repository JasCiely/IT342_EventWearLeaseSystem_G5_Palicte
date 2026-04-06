import React from 'react';
import '../../../components/css/customerDashboard/DashboardFragment.css';

const BrowseOutfitsFragment = () => {
    const outfits = [
        { id: 1, name: "Premium Velvet Sherwani", price: "₱15,000", cat: "Traditional" },
        { id: 2, name: "Midnight Silk Gown", price: "₱12,500", cat: "Evening Wear" },
        { id: 3, name: "Modern Slim-Fit Tux", price: "₱10,000", cat: "Formal" },
        { id: 4, name: "Floral Summer Filipiñana", price: "₱8,000", cat: "Traditional" },
    ];

    return (
        <div className="fragment-container">
            <h2 className="card-title">Browse Our Collection</h2>
            <div className="featured-outfits-container" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {outfits.map(outfit => (
                    <div key={outfit.id} className="customer-card">
                        <div className="outfit-preview-box" style={{ height: '200px' }}></div>
                        <p style={{ fontWeight: 'bold', margin: '10px 0 5px 0' }}>{outfit.name}</p>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>{outfit.cat}</p>
                        <p style={{ color: '#2b1017', fontWeight: 'bold', marginBottom: '15px' }}>{outfit.price}</p>
                        <button className="btn-check-availability">View Details</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrowseOutfitsFragment;