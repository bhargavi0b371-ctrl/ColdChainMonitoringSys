const alerts = new Map();
const auditLogs = [];

export const db = {
  getAlerts(status) {
    const entries = [...alerts.values()];
    return status ? entries.filter((alert) => alert.status === status) : entries;
  },

  acknowledgeAlert(id, actor, notes) {
    const alert = alerts.get(id);
    if (!alert) return null;

    Object.assign(alert, {
      status: 'acknowledged',
      acknowledged_by: actor,
      notes,
      acknowledged_at: new Date().toISOString(),
    });
    return { ...alert };
  },

  resolveAlert(id) {
    const alert = alerts.get(id);
    if (!alert) return null;

    Object.assign(alert, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    });
    return { ...alert };
  },

  addAuditLog(action, shipmentId, deviceId, actor, details) {
    auditLogs.push({
      action,
      shipment_id: shipmentId,
      device_id: deviceId,
      actor,
      details,
      created_at: new Date().toISOString(),
    });
  },
};
