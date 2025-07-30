import { db } from "./db";
import { auditLogs } from "@shared/schema";
import type { InsertAuditLog, Permit } from "@shared/schema";

export interface AuditContext {
  userId: number;
  actionType: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export class AuditLogger {
  /**
   * Log permit changes by comparing old and new values
   */
  async logPermitChanges(
    originalPermit: Permit | null,
    updatedPermit: Permit,
    context: AuditContext
  ): Promise<void> {
    try {
      const changes = this.detectChanges(originalPermit, updatedPermit);
      
      for (const change of changes) {
        await this.createAuditEntry({
          permitId: updatedPermit.id,
          userId: context.userId,
          actionType: context.actionType,
          fieldName: change.field,
          oldValue: this.formatValue(change.oldValue),
          newValue: this.formatValue(change.newValue),
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
          metadata: {
            ...context.metadata,
            permitId: updatedPermit.permitId,
            permitType: updatedPermit.type,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Special handling for status changes
      if (originalPermit?.status !== updatedPermit.status) {
        await this.logStatusChange(updatedPermit, originalPermit?.status, updatedPermit.status, context);
      }

      console.log(`Audit: Logged ${changes.length} changes for permit ${updatedPermit.permitId} by user ${context.userId}`);
    } catch (error) {
      console.error("Error logging audit changes:", error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log creation of new permit
   */
  async logPermitCreation(permit: Permit, context: AuditContext): Promise<void> {
    try {
      await this.createAuditEntry({
        permitId: permit.id,
        userId: context.userId,
        actionType: 'create',
        fieldName: null,
        oldValue: null,
        newValue: JSON.stringify({
          permitId: permit.permitId,
          type: permit.type,
          status: permit.status
        }),
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        metadata: {
          permitId: permit.permitId,
          permitType: permit.type,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`Audit: Logged creation of permit ${permit.permitId} by user ${context.userId}`);
    } catch (error) {
      console.error("Error logging permit creation:", error);
    }
  }

  /**
   * Log permit deletion
   */
  async logPermitDeletion(permit: Permit, context: AuditContext): Promise<void> {
    try {
      await this.createAuditEntry({
        permitId: permit.id,
        userId: context.userId,
        actionType: 'delete',
        fieldName: null,
        oldValue: JSON.stringify({
          permitId: permit.permitId,
          type: permit.type,
          status: permit.status
        }),
        newValue: null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        metadata: {
          permitId: permit.permitId,
          permitType: permit.type,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`Audit: Logged deletion of permit ${permit.permitId} by user ${context.userId}`);
    } catch (error) {
      console.error("Error logging permit deletion:", error);
    }
  }

  /**
   * Log status changes specifically
   */
  private async logStatusChange(
    permit: Permit,
    oldStatus: string | undefined,
    newStatus: string,
    context: AuditContext
  ): Promise<void> {
    await this.createAuditEntry({
      permitId: permit.id,
      userId: context.userId,
      actionType: 'status_change',
      fieldName: 'status',
      oldValue: oldStatus || 'undefined',
      newValue: newStatus,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      metadata: {
        permitId: permit.permitId,
        permitType: permit.type,
        statusTransition: `${oldStatus || 'undefined'} -> ${newStatus}`,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Create audit log entry in database
   */
  private async createAuditEntry(entry: InsertAuditLog): Promise<void> {
    await db.insert(auditLogs).values(entry);
  }

  /**
   * Detect changes between old and new permit objects
   */
  private detectChanges(original: Permit | null, updated: Permit): FieldChange[] {
    if (!original) {
      return []; // Creation is handled separately
    }

    const changes: FieldChange[] = [];
    const fieldsToTrack = [
      'type', 'location', 'description', 'requestorName', 'department',
      'contactNumber', 'emergencyContact', 'startDate', 'endDate',
      'status', 'riskLevel', 'safetyOfficer', 'departmentHead',
      'maintenanceApprover', 'identifiedHazards', 'additionalComments',
      'selectedHazards', 'hazardNotes', 'completedMeasures',
      'performerName', 'performerSignature', 'preWorkMeasuresSignature',
      'workRemovalSignature', 'immediateActions', 'beforeWorkStarts',
      'complianceNotes', 'overallRisk', 'workLocationId',
      'mapPositionX', 'mapPositionY'
    ];

    for (const field of fieldsToTrack) {
      const oldValue = (original as any)[field];
      const newValue = (updated as any)[field];

      if (this.hasValueChanged(oldValue, newValue)) {
        changes.push({
          field,
          oldValue,
          newValue
        });
      }
    }

    return changes;
  }

  /**
   * Check if a value has actually changed
   */
  private hasValueChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined comparisons
    if (oldValue === null && newValue === null) return false;
    if (oldValue === undefined && newValue === undefined) return false;
    if (oldValue === null && newValue === "") return false;
    if (oldValue === "" && newValue === null) return false;

    // Handle arrays
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    // Handle dates
    if (oldValue instanceof Date && newValue instanceof Date) {
      return oldValue.getTime() !== newValue.getTime();
    }

    // Handle objects
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    return oldValue !== newValue;
  }

  /**
   * Format values for storage
   */
  private formatValue(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get audit logs for a specific permit
   */
  async getPermitAuditLogs(permitId: number): Promise<any[]> {
    const logs = await db
      .select({
        id: auditLogs.id,
        actionType: auditLogs.actionType,
        fieldName: auditLogs.fieldName,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId
      })
      .from(auditLogs)
      .where(db.eq(auditLogs.permitId, permitId))
      .orderBy(db.desc(auditLogs.createdAt));

    return logs;
  }

  /**
   * Get all audit logs with optional filters
   */
  async getAllAuditLogs(filters?: {
    userId?: number;
    permitId?: number;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query = db
      .select({
        id: auditLogs.id,
        permitId: auditLogs.permitId,
        userId: auditLogs.userId,
        actionType: auditLogs.actionType,
        fieldName: auditLogs.fieldName,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt
      })
      .from(auditLogs);

    // Apply filters if provided
    if (filters?.userId) {
      query = query.where(db.eq(auditLogs.userId, filters.userId));
    }
    if (filters?.permitId) {
      query = query.where(db.eq(auditLogs.permitId, filters.permitId));
    }
    if (filters?.actionType) {
      query = query.where(db.eq(auditLogs.actionType, filters.actionType));
    }

    query = query.orderBy(db.desc(auditLogs.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();