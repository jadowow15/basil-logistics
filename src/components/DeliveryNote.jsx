import React from 'react';

// A component designed strictly for printing
// It should be rendered within a div that only appears during @media print
const DeliveryNote = ({ order }) => {
  if (!order) return null;

  const dispatchedQty = (order.current_dispatch_amount || parseInt(order.dispatch_info) || order.handed_to_dispatch_total || 0).toLocaleString();
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="printable-delivery-note">
      <div className="print-header">
        <div className="print-logo-section">
          {/* Use absolute path for logo to ensure it prints */}
          <img src="/basil-logo.avif" alt="Basil Logo" className="print-logo" />
          <div className="print-company-info">
            <h1>BASIL INDUSTRIES LTD</h1>
            <p>OFFICIAL DELIVERY NOTE</p>
          </div>
        </div>
        <div className="print-meta">
          <p><strong>Date:</strong> {dateStr}</p>
          <p><strong>Time:</strong> {timeStr}</p>
          <p><strong>Order Ref:</strong> {order.id?.split('-')[0].toUpperCase()}</p>
        </div>
      </div>

      <div className="print-divider"></div>

      <div className="print-section">
        <h2>Client Information</h2>
        <div className="print-grid">
          <div className="print-field">
            <label>Client / Entity Name:</label>
            <div className="print-value">{order.client_name}</div>
          </div>
          <div className="print-field">
            <label>Contact Number:</label>
            <div className="print-value">{order.client_phone || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div className="print-section">
        <h2>Order Consignment Details</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Product Description</th>
              <th style={{ textAlign: 'right' }}>Dispatched Quantity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{order.product_name}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{dispatchedQty} units</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Optional: Driver/Truck info if it exists in the order */}
      {(order.truck_details || order.driver_info) && (
        <div className="print-section">
          <h2>Logistics Info</h2>
          <div className="print-grid">
            {order.driver_info && (
              <div className="print-field">
                <label>Driver Info:</label>
                <div className="print-value">{order.driver_info}</div>
              </div>
            )}
            {order.truck_details && (
              <div className="print-field">
                <label>Truck Details:</label>
                <div className="print-value">{order.truck_details}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="print-signatures">
        <div className="signature-box">
          <h3>Delivery Responsible (Driver / Dispatch)</h3>
          <p className="sig-text">I confirm that the items listed above have been loaded and dispatched in good condition.</p>
          <div className="sig-line"><span>Name:</span></div>
          <div className="sig-line"><span>Signature:</span></div>
          <div className="sig-line"><span>Date & Time:</span></div>
        </div>

        <div className="signature-box">
          <h3>Client / Receiver</h3>
          <p className="sig-text">I confirm receipt of the items listed above in good condition, in the quantities stated.</p>
          <div className="sig-line"><span>Name:</span></div>
          <div className="sig-line"><span>Signature:</span></div>
          <div className="sig-line"><span>Date & Time:</span></div>
        </div>
      </div>

      <div className="print-signatures" style={{ marginTop: '30px' }}>
        <div className="signature-box">
          <h3>Checked By</h3>
          <div className="sig-line"><span>Name:</span></div>
          <div className="sig-line"><span>Signature:</span></div>
        </div>
        
        <div className="signature-box">
          <h3>Verified By</h3>
          <div className="sig-line"><span>Name:</span></div>
          <div className="sig-line"><span>Signature:</span></div>
        </div>

        <div className="signature-box">
          <h3>Authorized By</h3>
          <div className="sig-line"><span>Name:</span></div>
          <div className="sig-line"><span>Signature:</span></div>
        </div>
      </div>

      <div className="print-footer">
        <p>Basil Industries Ltd • Internal Logistics System • Generated on {dateStr} at {timeStr}</p>
      </div>
    </div>
  );
};

export default DeliveryNote;
