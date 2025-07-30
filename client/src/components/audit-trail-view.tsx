import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, Download, Eye, Clock, User, FileText, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AuditLog {
  id: number;
  permitId: number;
  userId: number;
  actionType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
  userName: string;
  userFullName: string;
  permitIdString: string;
  permitType: string;
}

interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  recentActions: { actionType: string; count: number }[];
}

interface AuditTrailViewProps {
  permitId?: number;
  userId?: number;
  className?: string;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  'create': 'Erstellt',
  'update': 'Aktualisiert',
  'delete': 'Gelöscht',
  'status_change': 'Status geändert',
  'approval': 'Genehmigt',
  'signature': 'Unterschrift'
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  'create': 'bg-green-100 text-green-800',
  'update': 'bg-blue-100 text-blue-800',
  'delete': 'bg-red-100 text-red-800',
  'status_change': 'bg-yellow-100 text-yellow-800',
  'approval': 'bg-purple-100 text-purple-800',
  'signature': 'bg-indigo-100 text-indigo-800'
};

export function AuditTrailView({ permitId, userId, className }: AuditTrailViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch audit logs
  const { data: auditLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['audit-logs', { permitId, userId, actionType: actionTypeFilter, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (permitId) params.append('permitId', permitId.toString());
      if (userId) params.append('userId', userId.toString());
      if (actionTypeFilter && actionTypeFilter !== 'all') params.append('actionType', actionTypeFilter);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json() as Promise<AuditLog[]>;
    }
  });

  // Fetch audit statistics (only for global view)
  const { data: auditStats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const response = await fetch('/api/audit-logs/stats');
      if (!response.ok) throw new Error('Failed to fetch audit stats');
      return response.json() as Promise<AuditStats>;
    },
    enabled: !permitId && !userId // Only fetch stats for global view
  });

  // Filter logs based on search term
  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.permitIdString?.toLowerCase().includes(searchLower) ||
      log.userFullName?.toLowerCase().includes(searchLower) ||
      log.fieldName?.toLowerCase().includes(searchLower) ||
      log.oldValue?.toLowerCase().includes(searchLower) ||
      log.newValue?.toLowerCase().includes(searchLower)
    );
  });

  const formatValue = (value: string | null) => {
    if (!value) return 'Leer';
    if (value.length > 100) return value.substring(0, 100) + '...';
    return value;
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create': return <FileText className="w-4 h-4" />;
      case 'update': return <Settings className="w-4 h-4" />;
      case 'delete': return <FileText className="w-4 h-4" />;
      case 'status_change': return <Clock className="w-4 h-4" />;
      case 'approval': return <User className="w-4 h-4" />;
      case 'signature': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Stats (only for global view) */}
      {!permitId && !userId && auditStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt Einträge</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditStats.totalLogs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heute</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditStats.todayLogs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Häufigste Aktionen</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {auditStats.recentActions.slice(0, 3).map((action, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{ACTION_TYPE_LABELS[action.actionType] || action.actionType}</span>
                    <span className="font-medium">{action.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter & Suche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche in Logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Aktionstyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="update">Aktualisiert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="status_change">Status geändert</SelectItem>
                <SelectItem value="approval">Genehmigt</SelectItem>
                <SelectItem value="signature">Unterschrift</SelectItem>
              </SelectContent>
            </Select>

            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 Einträge</SelectItem>
                <SelectItem value="50">50 Einträge</SelectItem>
                <SelectItem value="100">100 Einträge</SelectItem>
                <SelectItem value="200">200 Einträge</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setActionTypeFilter('all');
                  setUserFilter('');
                  setOffset(0);
                }}
              >
                Zurücksetzen
              </Button>
              <Button variant="outline" onClick={() => refetchLogs()}>
                <Download className="w-4 h-4 mr-2" />
                Aktualisieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>
            {filteredLogs.length} von {auditLogs.length} Einträgen
            {permitId && ` für Genehmigung ${auditLogs[0]?.permitIdString}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8">Lade Audit-Logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Audit-Logs gefunden
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-4">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getActionIcon(log.actionType)}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={ACTION_TYPE_COLORS[log.actionType] || 'bg-gray-100 text-gray-800'}>
                              {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                            </Badge>
                            {log.permitIdString && (
                              <Badge variant="outline">
                                {log.permitIdString}
                              </Badge>
                            )}
                            {log.fieldName && (
                              <Badge variant="secondary">
                                {log.fieldName}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.userFullName || log.userName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                              </span>
                            </div>
                          </div>

                          {(log.oldValue || log.newValue) && (
                            <div className="space-y-1 text-sm">
                              {log.oldValue && (
                                <div>
                                  <span className="font-medium text-red-600">Alt:</span> {formatValue(log.oldValue)}
                                </div>
                              )}
                              {log.newValue && (
                                <div>
                                  <span className="font-medium text-green-600">Neu:</span> {formatValue(log.newValue)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {log.metadata && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                              <DialogDescription>
                                Detaillierte Informationen zu diesem Audit-Eintrag
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Aktion:</strong> {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                                </div>
                                <div>
                                  <strong>Benutzer:</strong> {log.userFullName}
                                </div>
                                <div>
                                  <strong>Zeitpunkt:</strong> {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                                </div>
                                <div>
                                  <strong>IP-Adresse:</strong> {log.ipAddress || 'Nicht verfügbar'}
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div>
                                <strong>Metadaten:</strong>
                                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                              
                              <div>
                                <strong>User Agent:</strong>
                                <p className="mt-1 text-xs text-muted-foreground break-all">
                                  {log.userAgent || 'Nicht verfügbar'}
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {auditLogs.length >= limit && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            Vorherige
          </Button>
          <Button
            variant="outline"
            onClick={() => setOffset(offset + limit)}
            disabled={auditLogs.length < limit}
          >
            Nächste
          </Button>
        </div>
      )}
    </div>
  );
}