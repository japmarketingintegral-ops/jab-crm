// Tipos escritos a mano para que el proyecto compile antes de tener un
// proyecto de Supabase real conectado. Una vez creado, regenerar con:
//
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
//
// y borrar este comentario.

export type UserRole = 'super_admin' | 'client_admin' | 'supervisor' | 'salesperson' | 'jab_staff';
export type LeadPlatform = 'meta' | 'google' | 'whatsapp';
/** No es un enum de Postgres — es una columna `text` (ver schema.sql, sección
 * WhatsApp), los valores válidos se validan en el código, no en la base. */
export type WhatsappEstado = 'desconectado' | 'esperando_qr' | 'conectado' | 'error';
export type LeadStatus = 'nuevo' | 'contactado' | 'calificado' | 'ganado' | 'perdido';
export type LeadActivityType = 'nota' | 'cambio_estado' | 'reasignacion' | 'seguimiento' | 'mensaje';
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'otra';
export type PipelineConfig = Partial<Record<LeadStatus, { label: string; visible: boolean }>>;
export type PedidoEstado = 'pedido' | 'en_proceso' | 'revision' | 'aprobado';
export type PedidoCategoria = 'redes' | 'contenido' | 'comunicado' | 'video' | 'pauta' | 'otro';
export type TareaInternaEstado = 'materiales' | 'en_proceso' | 'revision' | 'ads' | 'on_hold' | 'aprobado';

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          auto_asignacion: boolean;
          round_robin_ultimo_id: string | null;
          pipeline_config: PipelineConfig | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          auto_asignacion?: boolean;
          round_robin_ultimo_id?: string | null;
          pipeline_config?: PipelineConfig | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenants_round_robin_ultimo_id_fkey';
            columns: ['round_robin_ultimo_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          role: UserRole;
          full_name: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          role?: UserRole;
          full_name?: string | null;
          email: string;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      lead_sources: {
        Row: {
          id: string;
          tenant_id: string;
          platform: LeadPlatform;
          external_account_id: string;
          display_name: string;
          connected_at: string | null;
          created_at: string;
          access_token: string | null;
          instagram_business_account_id: string | null;
          token_actualizado_en: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          platform: LeadPlatform;
          external_account_id: string;
          display_name: string;
          connected_at?: string | null;
          created_at?: string;
          access_token?: string | null;
          instagram_business_account_id?: string | null;
          token_actualizado_en?: string | null;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['lead_sources']['Insert']>;
      };
      meta_conexiones_pendientes: {
        Row: {
          id: string;
          tenant_id: string;
          paginas: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          paginas: unknown;
          created_at?: string;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['meta_conexiones_pendientes']['Insert']>;
      };
      leads: {
        Row: {
          id: string;
          tenant_id: string;
          source_id: string | null;
          assigned_to: string | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          phone_normalized: string | null;
          status: LeadStatus;
          raw_payload: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          next_followup_at: string | null;
          tags: string[];
          valor: number | null;
          cerrado_en: string | null;
          ultima_actividad_vista_en: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          source_id?: string | null;
          assigned_to?: string | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          phone_normalized?: string | null;
          status?: LeadStatus;
          raw_payload?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          next_followup_at?: string | null;
          tags?: string[];
          valor?: number | null;
          cerrado_en?: string | null;
          ultima_actividad_vista_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'lead_sources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          tenant_id: string;
          autor_id: string | null;
          tipo: LeadActivityType;
          contenido: string | null;
          created_at: string;
          wa_message_id: string | null;
          wa_status: string | null;
          wa_media_url: string | null;
          wa_media_type: string | null;
        };
        Insert: {
          id?: string;
          lead_id: string;
          tenant_id: string;
          autor_id?: string | null;
          tipo: LeadActivityType;
          contenido?: string | null;
          created_at?: string;
          wa_message_id?: string | null;
          wa_status?: string | null;
          wa_media_url?: string | null;
          wa_media_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lead_activities_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lead_activities_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['lead_activities']['Insert']>;
      };
      social_posts: {
        Row: {
          id: string;
          tenant_id: string;
          plataforma: SocialPlatform;
          titulo: string | null;
          url: string | null;
          imagen_url: string | null;
          publicado_en: string;
          alcance: number;
          me_gusta: number;
          comentarios: number;
          compartidos: number;
          creado_por: string | null;
          created_at: string;
          external_id: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plataforma: SocialPlatform;
          titulo?: string | null;
          url?: string | null;
          imagen_url?: string | null;
          publicado_en: string;
          alcance?: number;
          me_gusta?: number;
          comentarios?: number;
          compartidos?: number;
          creado_por?: string | null;
          created_at?: string;
          external_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'social_posts_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['social_posts']['Insert']>;
      };
      pedidos: {
        Row: {
          id: string;
          tenant_id: string;
          titulo: string;
          descripcion: string | null;
          estado: PedidoEstado;
          categoria: PedidoCategoria;
          asignado_a: string | null;
          fecha_programada: string | null;
          creado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          titulo: string;
          descripcion?: string | null;
          estado?: PedidoEstado;
          categoria?: PedidoCategoria;
          asignado_a?: string | null;
          fecha_programada?: string | null;
          creado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedidos_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_asignado_a_fkey';
            columns: ['asignado_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>;
      };
      pedido_archivos: {
        Row: {
          id: string;
          pedido_id: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pedido_id: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedido_archivos_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_archivos_subido_por_fkey';
            columns: ['subido_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['pedido_archivos']['Insert']>;
      };
      pedido_comentarios: {
        Row: {
          id: string;
          pedido_id: string;
          tenant_id: string;
          autor_id: string | null;
          texto: string;
          tipo: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pedido_id: string;
          tenant_id: string;
          autor_id?: string | null;
          texto: string;
          tipo?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedido_comentarios_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_comentarios_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['pedido_comentarios']['Insert']>;
      };
      pedido_checklist_items: {
        Row: {
          id: string;
          created_at: string;
          pedido_id: string;
          texto: string;
          completado: boolean;
          orden: number;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          pedido_id: string;
          texto: string;
          completado?: boolean;
          orden?: number;
          tenant_id: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedido_checklist_items_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['pedido_checklist_items']['Insert']>;
      };
      tarea_comentarios: {
        Row: {
          id: string;
          tarea_id: string;
          tenant_id: string;
          autor_id: string | null;
          texto: string;
          tipo: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tarea_id: string;
          tenant_id: string;
          autor_id?: string | null;
          texto: string;
          tipo?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarea_comentarios_tarea_id_fkey';
            columns: ['tarea_id'];
            isOneToOne: false;
            referencedRelation: 'tareas_internas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarea_comentarios_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['tarea_comentarios']['Insert']>;
      };
      tarea_archivos: {
        Row: {
          id: string;
          tarea_id: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tarea_id: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarea_archivos_tarea_id_fkey';
            columns: ['tarea_id'];
            isOneToOne: false;
            referencedRelation: 'tareas_internas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tarea_archivos_subido_por_fkey';
            columns: ['subido_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['tarea_archivos']['Insert']>;
      };
      tarea_checklist_items: {
        Row: {
          id: string;
          created_at: string;
          tarea_id: string;
          texto: string;
          completado: boolean;
          orden: number;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          tarea_id: string;
          texto: string;
          completado?: boolean;
          orden?: number;
          tenant_id: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarea_checklist_items_tarea_id_fkey';
            columns: ['tarea_id'];
            isOneToOne: false;
            referencedRelation: 'tareas_internas';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['tarea_checklist_items']['Insert']>;
      };
      tablero_etiquetas: {
        Row: {
          id: string;
          created_at: string;
          tenant_id: string;
          nombre: string;
          color: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          tenant_id: string;
          nombre: string;
          color: string;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['tablero_etiquetas']['Insert']>;
      };
      materiales: {
        Row: {
          id: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          nombre_archivo: string;
          ruta_storage: string;
          subido_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'materiales_subido_por_fkey';
            columns: ['subido_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['materiales']['Insert']>;
      };
      staff_acceso_clientes: {
        Row: {
          id: string;
          usuario_id: string;
          tenant_id: string;
          puede_ver_crm: boolean;
          otorgado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tenant_id: string;
          puede_ver_crm?: boolean;
          otorgado_por?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_acceso_clientes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_acceso_clientes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['staff_acceso_clientes']['Insert']>;
      };
      tareas_internas: {
        Row: {
          id: string;
          tenant_id: string;
          titulo: string;
          descripcion: string | null;
          estado: TareaInternaEstado;
          etiquetas: string[];
          asignado_a: string | null;
          fecha_programada: string | null;
          creado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          titulo: string;
          descripcion?: string | null;
          estado?: TareaInternaEstado;
          etiquetas?: string[];
          asignado_a?: string | null;
          fecha_programada?: string | null;
          creado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tareas_internas_asignado_a_fkey';
            columns: ['asignado_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tareas_internas_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['tareas_internas']['Insert']>;
      };
      onboarding_briefs: {
        Row: {
          tenant_id: string;
          empresa_descripcion: string | null;
          cliente_ideal: string | null;
          que_vende: string | null;
          objetivos: string | null;
          notas: string | null;
          actualizado_por: string | null;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          empresa_descripcion?: string | null;
          cliente_ideal?: string | null;
          que_vende?: string | null;
          objetivos?: string | null;
          notas?: string | null;
          actualizado_por?: string | null;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['onboarding_briefs']['Insert']>;
      };
      onboarding_accesos: {
        Row: {
          id: string;
          tenant_id: string;
          servicio: string;
          usuario: string | null;
          contrasena: string | null;
          notas: string | null;
          creado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          servicio: string;
          usuario?: string | null;
          contrasena?: string | null;
          notas?: string | null;
          creado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Update: Partial<Database['public']['Tables']['onboarding_accesos']['Insert']>;
      };
      whatsapp_conexiones: {
        Row: {
          id: string;
          created_at: string;
          tenant_id: string;
          estado: WhatsappEstado;
          numero_whatsapp: string | null;
          qr: string | null;
          qr_generado_en: string | null;
          conectado_en: string | null;
          ultimo_error: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          tenant_id: string;
          estado?: WhatsappEstado;
          numero_whatsapp?: string | null;
          qr?: string | null;
          qr_generado_en?: string | null;
          conectado_en?: string | null;
          ultimo_error?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_conexiones_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['whatsapp_conexiones']['Insert']>;
      };
      whatsapp_credenciales: {
        Row: {
          tenant_id: string;
          auth_state: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          auth_state?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_credenciales_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
        Update: Partial<Database['public']['Tables']['whatsapp_credenciales']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      lead_platform: LeadPlatform;
      lead_status: LeadStatus;
      lead_activity_type: LeadActivityType;
      social_platform: SocialPlatform;
      pedido_estado: PedidoEstado;
      pedido_categoria: PedidoCategoria;
      tarea_interna_estado: TareaInternaEstado;
    };
    CompositeTypes: Record<string, never>;
  };
}
