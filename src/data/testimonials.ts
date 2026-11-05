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
  {
    name: 'Prashant',
    role: 'ApplyMate member',
    quote: `I came across ApplyMate through Google. Honestly, before joining, I wasn't very confident. I had the same doubts that most people have, whether it would actually be worth the money or just another service that takes payment without delivering the desired results.

However, I decided to give them a try, and guess what? They surprised me right from the very first call by offering a 7-day trial at a much more affordable price.

As the days passed, my confidence and trust in their service continued to grow. Today, I genuinely feel that I might have missed out on a great opportunity if I hadn't given them a chance.

The team is putting in its best efforts by identifying and applying for suitable job opportunities based on my profile every day. What I appreciate even more is that they don't just apply on my behalf; they also guide me on where and how I can apply personally for opportunities that they cannot apply to directly.

It's not just about job applications; it's about the support, guidance, transparency and trust they provide throughout the process.

I am genuinely happy with their support and the efforts they are making.

I would wholeheartedly recommend ApplyMate to anyone looking for support with their job search. Sometimes, giving something a chance is all it takes to discover its real value!

Thank you, Team ApplyMate! Keep up the great work.`,
  },
]
