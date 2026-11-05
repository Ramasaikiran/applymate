// Real member testimonials only. The section stays hidden while this list is empty.
// Add an entry only with the member's permission to publish their name and words.
export interface Testimonial {
  name: string
  role: string          // e.g. "Software Engineer at Nestack Technologies"
  quote: string         // the member's own words; separate paragraphs with a blank line
  photo?: string        // optional, e.g. '/testimonials/name.jpg'
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Shiji',
    role: 'ApplyMate member',
    quote: `I had a wonderful experience with ApplyMate! They provided excellent support throughout my job search by helping me apply for relevant job opportunities every day and creating customised resumes tailored to each job profile. This made the entire job application process much easier and more effective.

A special thanks to Kiran, who was extremely supportive, approachable, and dedicated throughout the journey. His continuous guidance, prompt assistance, and encouragement made a real difference.

I truly appreciate the efforts of the entire ApplyMate team and would highly recommend their services to anyone looking for professional support in their job search. Thank you for making this journey smoother and stress-free!`,
  },
]
