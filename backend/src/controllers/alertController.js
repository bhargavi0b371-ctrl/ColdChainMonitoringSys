import { db } from '../config/db.js';

export const alertController = {
  list: (req, res) => {
    const { status } = req.query;
    const alerts = db.getAlerts(status);
    return res.json({ alerts, count: alerts.length });
  },

  acknowledge: (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const actor = req.user ? `${req.user.name} (${req.user.role})` : 'Jordan Davis (Fleet Manager)';

    const updated = db.acknowledgeAlert(
      id,
      actor,
      notes || 'Operator acknowledged anomaly on mobile dashboard.'
    );
    if (!updated) return res.status(404).json({ error: 'Alert not found' });

    db.addAuditLog('ALERT_ACKNOWLEDGED', updated.shipment_id, updated.device_id, actor, {
      alert_id: updated.id,
      severity: updated.severity,
      operator_notes: updated.notes,
      acknowledged_at: updated.acknowledged_at,
    });

    return res.json({ message: 'Alert acknowledged', alert: updated });
  },

  resolve: (req, res) => {
    const { id } = req.params;
    const actor = req.user ? `${req.user.name} (${req.user.role})` : 'Jordan Davis (Fleet Manager)';

    const updated = db.resolveAlert(id);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });

    db.addAuditLog('ALERT_RESOLVED', updated.shipment_id, updated.device_id, actor, {
      alert_id: updated.id,
      resolved_at: updated.resolved_at,
    });

    return res.json({ message: 'Alert resolved and marked clear', alert: updated });
  },
};
