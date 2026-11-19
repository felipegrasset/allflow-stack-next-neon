import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>

export interface CoursesCoursesTable {
  id: string
  title: string
  summary: string | null
  description: ColumnType<string, string | undefined, string>
  status: ColumnType<string, string | undefined, string>
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CoursesLessonsTable {
  id: string
  course_id: string
  title: string
  body: ColumnType<string, string | undefined, string>
  position: ColumnType<number, number | undefined, number>
  meeting_url: string | null
  starts_at: NullableTimestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CoursesEnrollmentsTable {
  course_id: string
  user_id: string
  enrolled_at: Timestamp
}

export interface CoursesProgressTable {
  lesson_id: string
  user_id: string
  course_id: string
  completed_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    courses_courses: CoursesCoursesTable
    courses_lessons: CoursesLessonsTable
    courses_enrollments: CoursesEnrollmentsTable
    courses_progress: CoursesProgressTable
  }
}
