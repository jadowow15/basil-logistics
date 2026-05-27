import React from 'react';

const MaterialIssueNote = ({ issueRecord }) => {
  if (!issueRecord) return null;

  const dateStr = new Date(issueRecord.issued_date || new Date()).toLocaleDateString();
  const timeStr = new Date(issueRecord.issued_date || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="printable-delivery-note">
      <div className="print-header">
        <div className="print-logo-section">
          {/* Reusing the company logo from the Delivery Note */}
          <img src="/basil-logo.avif" alt="Basil Logo" className="print-logo" />
          <div className="print-company-info">
            <h1>BASIL INDUSTRIES LTD</h1>
            <p>Internal Material Issue Note</p>
          </div>
        </div>
        <div className="print-meta">
          <p><strong>Date:</strong> {dateStr}</p>
          <p><strong>Time:</strong> {timeStr}</p>
          <p><strong>Issue Ref:</strong> {issueRecord.id?.split('-')[0].toUpperCase()}</p>
        </div>
      </div>

      <div className="print-divider"></div>

      <div className="print-section">
        <h2>Issue Details</h2>
        <div className="print-grid">
          <div className="print-field">
            <label>Destination (Machine/Dept):</label>
            <div className="print-value">{issueRecord.destination}</div>
          </div>
          <div className="print-field">
            <label>Receiver Name:</label>
            <div className="print-value">{issueRecord.received_by}</div>
          </div>
        </div>
        
        {issueRecord.purpose && (
          <div className="print-grid" style={{ marginTop: '15px' }}>
            <div className="print-field">
              <label>Purpose / Notes:</label>
              <div className="print-value">{issueRecord.purpose}</div>
            </div>
          </div>
        )}
      </div>

      <div className="print-section">
        <h2>Material Consignment</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Material Description</th>
              <th>Original Entry Ref</th>
              <th style={{ textAlign: 'right' }}>Quantity Issued</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{issueRecord.item_name}</td>
              <td>{issueRecord.raw_material_id ? issueRecord.raw_material_id.substring(0,8).toUpperCase() : 'N/A'}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {issueRecord.quantity} {issueRecord.unit}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="print-signatures">
        <div className="signature-box">
          <h3>Issued By (Store Keeper)</h3>
          <p className="sig-text">I confirm that the materials listed above have been issued in good condition and in the specified quantities.</p>
          <div className="sig-line"><span>Name: {issueRecord.issued_by}</span></div>
          <div className="sig-line"><span>Signature:</span></div>
          <div className="sig-line"><span>Date & Time:</span></div>
        </div>

        <div className="signature-box">
          <h3>Received By (Production)</h3>
          <p className="sig-text">I confirm receipt of the materials listed above in good condition, in the quantities stated.</p>
          <div className="sig-line"><span>Name: {issueRecord.received_by}</span></div>
          <div className="sig-line"><span>Signature:</span></div>
          <div className="sig-line"><span>Date & Time:</span></div>
        </div>
      </div>

      <div className="print-footer">
        <p>Basil Industries Ltd • Internal Logistics System • Generated on {dateStr} at {timeStr}</p>
      </div>
    </div>
  );
};

export default MaterialIssueNote;
