/**
 * =========================================================
 * SERVICES BARREL (CENTRAL EXPORT)
 * =========================================================
 *
 * Este arquivo centraliza TODOS os services do sistema.
 *
 * 📌 PADRÃO OFICIAL DO PROJETO:
 * - Services em camelCase → intakeService
 * - Nunca usar PascalCase (IntakeService)
 *
 * ✔ Isso evita erros de import/export no Vite
 * ✔ Facilita manutenção
 * ✔ Padroniza equipe
 *
 * 🚨 IMPORTANTE:
 * Sempre importar assim:
 *
 * ✔ import { intakeService } from '@/services';
 * ❌ NÃO importar direto do arquivo interno
 */

// =========================
// CORE SERVICES
// =========================
export { AuthService } from './auth.service';
export { ClientService } from './client.service';
export { UserService } from './user.service';
export { AdminService } from './admin.service';
export { JokeService } from './joke.service';
export { FinanceService } from './finance.service';
export { BoardService, TaskService } from './task.service';
export { KanbanService } from './kanban.service';
export { OnboardingService } from './onboarding.service';
export { DashboardService } from './dashboard.service';
export { FileService, DriveService } from './drive.service';
export { InteractionService } from './interaction.service';
export { PortalService } from './portal.service';
export { PostingCalendarService } from './posting-calendar.service';
export { SystemLogService, systemLog, systemError } from './system-log.service';

// =========================
// SHARED UTILS
// =========================
export {
  slugify,
  buildPortalUrl,
  buildDriveFileUrl,
  normalizeBoolean,
  isQuietClient,
  calculateFinanceSummary,
} from './_shared';

// =========================
// AGENCY OS
// =========================
export { TimelineService } from './timeline.service';
export type { TimelineEvent, EmitTimelinePayload } from './timeline.service';

export { ApprovalService } from './approval.service';
export type {
  Approval,
  CreateApprovalPayload,
  ApprovalStatus,
  ApprovalEntityType,
} from './approval.service';

export { HealthService } from './health.service';
export type { ClientHealth, HealthFactor, NextAction } from './health.service';

export { FileWorkflowService } from './file-workflow.service';
export type { FileRecord, FileVersion, FileComment } from './file-workflow.service';

// =========================
// ✅ INTAKE (CORRIGIDO)
// =========================
export { intakeService } from './intake.service';

/**
 * 🔹 intakeService
 * - CRUD de intake_requests
 * - contagem otimizada via RPC
 * - base do módulo de intake
 */

export type {
  IntakeTemplate,
  IntakeTemplateField,
  IntakeRequest,
  CreateIntakeRequestPayload,
  IntakeType,
  IntakePriority,
  IntakeStatus,
  IntakeSource,
} from './intake.service';

// =========================
// CONTENT / POSTS
// =========================
export { ContentApprovalService } from './content-approval.service';
export type {
  ApprovalItem,
  ApprovalItemStatus,
  ApprovalPlatform,
  ContentApproval,
  CreateApprovalItemPayload,
  CreateContentApprovalPayload,
  DecideItemPayload,
} from './content-approval.service';

export { PostWorkflowService } from './post-workflow.service';
export type { ChangeStatusInput, ChangeStatusResult } from './post-workflow.service';

/**
 * =========================================================
 * 📌 BOAS PRÁTICAS PARA DEV FUTURO
 * =========================================================
 *
 * 1. Sempre registrar novos services aqui
 * 2. Nunca importar direto de './arquivo.service'
 * 3. Manter padrão camelCase para services
 * 4. Tipos podem continuar em PascalCase
 *
 * ✔ Isso evita bugs de export
 * ✔ Facilita refactor
 * ✔ Mantém arquitetura limpa
 */
