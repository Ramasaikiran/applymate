// Real member testimonials only. The section stays hidden while this list is empty.
// Add an entry only with the member's permission to publish their name and words.
export interface Testimonial {
  name: string
  role: string          // e.g. "Software Engineer at Nestack Technologies"
  quote: string         // the member's own words
  photo?: string        // optional, e.g. '/testimonials/name.jpg'
}

export const TESTIMONIALS: Testimonial[] = []
