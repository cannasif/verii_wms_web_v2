import type { GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';

export type GeneratorProjectStatus = 'Draft' | 'ReadyToPlan' | 'Planned' | 'Released' | 'InProgress' | 'OnHold' | 'Completed' | 'Cancelled';
export type GeneratorPartType = 'Common' | 'Stator' | 'Rotor' | 'Stiffener' | 'FinalAssembly' | 'Outbound';
export type GeneratorRuleSeverity = 'Information' | 'Warning' | 'Error';
export type GeneratorOperationAction = 'Start' | 'Pause' | 'Resume' | 'Complete' | 'ReportProblem' | 'ResolveProblem';
export type GeneratorPlanningOrderStrategy = 'PriorityThenDelivery' | 'DeliveryThenPriority' | 'ManualOrderThenDelivery';

export interface GeneratorPolicy {
  id: number;
  branchCode: string;
  minimumProjectPriority: number;
  maximumProjectPriority: number;
  defaultProjectPriority: number;
  defaultProjectQuantity: number;
  maximumProjectQuantity: number;
  defaultLeadTimeDays: number;
  minimumPlanReasonLength: number;
  minimumOperationReasonLength: number;
  maximumScheduleRangeDays: number;
  schedulePastDays: number;
  scheduleFutureDays: number;
  ganttDefaultWindowDays: number;
  andonRefreshSeconds: number;
  workingCalendarSearchLimitDays: number;
  requireComponentForFinalAssembly: boolean;
  requireMaterialAvailabilityToStart: boolean;
  requireProblemClosureToComplete: boolean;
  requirePositiveCompletionQuantity: boolean;
  planningOrderStrategy: GeneratorPlanningOrderStrategy;
  rowVersion: string;
}

export interface GeneratorOverview { projectCount: number; plannedProjectCount: number; activeProjectCount: number; operationCount: number; delayedOperationCount: number; bottleneckStationCount: number }
export interface GeneratorProjectRow { id: number; projectCode: string; projectName: string; generatorType?: string; serialNumber?: string; customerName?: string; status: GeneratorProjectStatus; priority: number; quantity: number; plannedStartAtUtc: string; plannedDeliveryAtUtc: string; planningOrder: number; operationCount: number; completedOperationCount: number; rowVersion: string }
export interface GeneratorProjectDetail { id: number; productionHeaderId?: number; projectCode: string; projectName: string; generatorType?: string; serialNumber?: string; customerCode?: string; customerName?: string; externalWorkOrderNo?: string; sourceSystemCode?: string; plannedStartAtUtc: string; plannedDeliveryAtUtc: string; status: GeneratorProjectStatus; priority: number; quantity: number; hasStator: boolean; hasRotor: boolean; hasStiffener: boolean; includeFinalAssembly: boolean; planningOrder: number; description?: string; rowVersion: string }
export interface CreateGeneratorProjectRequest { projectCode: string; projectName: string; generatorType?: string | null; serialNumber?: string | null; customerCode?: string | null; customerName?: string | null; externalWorkOrderNo?: string | null; sourceSystemCode?: string | null; plannedStartAtUtc: string; plannedDeliveryAtUtc: string; priority: number; quantity: number; hasStator: boolean; hasRotor: boolean; hasStiffener: boolean; includeFinalAssembly: boolean; planningOrder: number; description?: string | null; productionHeaderId?: number | null }
export interface GeneratorStation { id: number; code: string; name: string; area: string; planningOrder: number; maxParallelJobs: number; defaultPersonnelCapacity: number; isActive: boolean; isCritical: boolean; isBottleneck: boolean; requiresCrane: boolean; requiresTransport: boolean; description?: string; rowVersion: string }
export interface GeneratorRouteOperation { id: number; operationCode: string; operationName: string; sequence: number; durationMinutes: number; minimumDurationMinutes: number; maximumDurationMinutes: number; isCritical: boolean; stationId: number; stationCode: string; stationName: string; rowVersion: string }
export interface GeneratorRouteDependency { id: number; predecessorOperationId: number; successorOperationId: number; dependencyType: 'FinishToStart' | 'StartToStart' | 'FinishToFinish'; lagMinutes: number }
export interface GeneratorRoute { id: number; code: string; name: string; partType: GeneratorPartType; versionNumber: number; isActive: boolean; operations: GeneratorRouteOperation[]; dependencies: GeneratorRouteDependency[] }
export interface GeneratorShift { id: number; code: string; name: string; startTime: string; endTime: string; planningOrder: number; isActive: boolean; rowVersion: string }
export interface GeneratorStationShift { id: number; stationId: number; stationCode: string; stationName: string; shiftId: number; shiftCode: string; shiftName: string; weekdayMask: number; capacityMinutes: number; personnelCapacity: number; machineCapacity: number; craneAvailable: boolean; transportAvailable: boolean; isActive: boolean; rowVersion: string }
export interface GeneratorCalendarException { id: number; stationId?: number; stationCode?: string; shiftId?: number; shiftCode?: string; exceptionDate: string; isWorking: boolean; capacityMinutes?: number; reason: string }
export interface GeneratorResourceStation { stationId: number; stationCode: string; stationName: string; requiredQuantity: number }
export interface GeneratorResource { id: number; code: string; name: string; resourceType: string; capacity: number; isExclusive: boolean; isActive: boolean; stations: GeneratorResourceStation[]; rowVersion: string }
export interface GeneratorRule { id: number; code: string; name: string; description: string; severity: GeneratorRuleSeverity; isEnabled: boolean; isSystemRequired: boolean; parametersJson?: string; rowVersion: string }
export interface GeneratorDefinitions { policy: GeneratorPolicy; stations: GeneratorStation[]; shifts: GeneratorShift[]; stationShifts: GeneratorStationShift[]; calendarExceptions: GeneratorCalendarException[]; resources: GeneratorResource[]; routes: GeneratorRoute[]; rules: GeneratorRule[]; isBootstrapped: boolean }
export interface GeneratorBootstrapResult { stationCount: number; routeCount: number; operationCount: number; ruleCount: number }
export interface GeneratorPlanningIssue { ruleCode: string; severity: GeneratorRuleSeverity; projectId?: number; message: string }
export interface GeneratorPlanPredecessor { key: string; dependencyType: 'FinishToStart' | 'StartToStart' | 'FinishToFinish'; lagMinutes: number }
export interface GeneratorPlanItem { key: string; projectId: number; projectCode: string; unitIndex: number; partType: GeneratorPartType; routeOperationId: number; stationId: number; stationCode: string; stationName: string; operationCode: string; operationName: string; plannedStartAtUtc: string; plannedEndAtUtc: string; isCritical: boolean; predecessors: GeneratorPlanPredecessor[] }
export interface GeneratorPlanPreview { items: GeneratorPlanItem[]; issues: GeneratorPlanningIssue[]; calculatedAtUtc: string; canApply: boolean }
export interface GeneratorPlanApplyResult { projectCount: number; operationCount: number; dependencyCount: number; revisionId: number; issues: GeneratorPlanningIssue[] }
export interface GeneratorScheduleRow { id: number; projectId: number; projectCode: string; projectName: string; unitIndex: number; partType: GeneratorPartType; stationId: number; stationCode: string; stationName: string; operationCode: string; operationName: string; status: string; plannedStartAtUtc: string; plannedEndAtUtc: string; actualStartAtUtc?: string; actualEndAtUtc?: string; isCritical: boolean; hasMaterialShortage: boolean; hasProblem: boolean; rowVersion: string }
export interface GeneratorPlanRevision { id: number; projectId?: number; projectCode?: string; actionType: string; reason: string; occurredAtUtc: string; actorUserId: number; hasPreviousPlan: boolean; operationCount: number }

export type GeneratorProjectPage = GridPage<GeneratorProjectRow>;
export type GeneratorProjectRequest = GridRequest;
