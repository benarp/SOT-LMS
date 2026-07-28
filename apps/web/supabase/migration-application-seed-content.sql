-- Migration: seed the real Application + Health & Wellness Survey question
-- set for the active school year(s), compiled from a reference admission
-- flow. Run AFTER migration-application-profile-wellness.sql.
--
-- Idempotent: skips a school year entirely (per form_key) if it already has
-- any fields for that form_key, so re-running this file is a no-op once
-- seeded and never clobbers admin edits made afterward via Form Builder.
--
-- IMPORTANT — placeholders: several answers below describe program specifics
-- (church name/address, class schedule, cost, retreat date, mission trip
-- year) that were only known from a *reference* application and are almost
-- certainly wrong for this program. They're marked `[TBD — ...]` inline.
-- An admin MUST review and correct these in Admin → Applications → Form
-- Builder before opening applications for real.

do $$
declare
  s record;
  v_relationship_status_id uuid;
  v_education_id uuid;
  v_volunteer_serve_id uuid;
  v_trouble_sleeping_id uuid;
  v_chronic_illness_id uuid;
  v_significant_illness_id uuid;
  v_handicap_id uuid;
  ord int;
begin
  for s in select id from school_years where is_active loop
    if exists (select 1 from application_fields where school_year_id = s.id and form_key = 'application') then
      continue;
    end if;

    ord := 1;

    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'application', 'header', 'School of Transformation Application', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'short_text', 'Preferred name', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'yes_no', 'Are you willing to receive and send text messages?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'short_text', 'Email', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'short_text', 'Age', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'yes_no', 'Are you a U.S. Citizen?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'application', 'select', 'Relationship status',
        jsonb_build_array('Single', 'Dating', 'Engaged', 'Married', 'Separated', 'Divorced', 'Widowed'),
        true, ord)
      returning id into v_relationship_status_id;
    ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'application', 'short_text', 'Name of your Significant Other', true, v_relationship_status_id, 'Dating', ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'application', 'short_text', 'Name of your Fiancé', true, v_relationship_status_id, 'Engaged', ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'application', 'short_text', 'Name of your Spouse', true, v_relationship_status_id, 'Married', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'application', 'select', 'What is the highest level of education you have completed?',
        jsonb_build_array('Not finished high school', 'High school diploma/GED', 'Some college', 'Technical school degree', 'Bachelor''s degree', 'Master''s degree', 'Doctorate'),
        true, ord)
      returning id into v_education_id;
    ord := ord + 1;

    -- Multi-value branch: shows for any degree-bearing answer, not just one
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_values, sort_order)
      values (s.id, 'application', 'short_text', 'What degree did you earn?', true, v_education_id,
        jsonb_build_array('Technical school degree', 'Bachelor''s degree', 'Master''s degree', 'Doctorate'), ord);
    ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'application', 'select', 'Please select your current employment status',
        jsonb_build_array(
          'I am employed full time (more than 30 hours a week)',
          'I am employed part time (less than 30 hours a week)',
          'I am self employed',
          'I am un-employed',
          'I am job searching',
          'I do not plan to work during the school year'
        ), true, ord); ord := ord + 1;

    -- Not required — the app's own header note says unchecked boxes are
    -- discussed in/before the interview rather than blocking submission.
    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'application', 'checkbox_group',
        'Please read over the following requirements and check all that apply.',
        'Any boxes not checked will be discussed in, or before, your interview.',
        jsonb_build_array(
          'I understand that I am applying to a 10-month Christian discipleship school focusing on personal transformation.',
          'I understand that class takes place on Tuesday nights from 6:00-9:30pm at [TBD — venue name and address], from the end of August through May.',
          'I understand that in addition to Tuesday night classes, I am expected to participate in Super Saturdays. These take place on six Saturdays out of the year, from 9:00am - 3:00pm.',
          'I understand that I am required to be at the School of Transformation all-day retreat on [TBD — retreat date].',
          'I understand that it is my responsibility to arrange my schedule, including (but not limited to) finding child care for my children, arranging transportation, requesting time off from my employer for all school related events, etc.',
          'I understand that the total cost of the school is [TBD — total cost], with a deposit of [TBD — deposit amount] due upon acceptance.',
          'I understand that I will be participating in a 10-14 day international mission trip after school ends in [TBD — mission trip year].',
          'I understand that I will be required to raise financial support or self-fund my mission trip expenses.',
          'I understand that I will be required to attend [TBD — church name] during the duration of the school year.',
          'I understand that I will be required to serve in a volunteer capacity at [TBD — church name] during the course of the school year.',
          'I understand that there will be required book reading, Bible reading, scripture memorization, and reflection papers as part of the school work.',
          'I understand that participation is expected for spiritual practices such as worship, fasting, prayer, and spending personal time with Jesus.',
          'I understand that there will be personal character and moral guidelines that I am expected to follow as a student (details can be found in the student handbook).'
        ), false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'short_text', 'How did you hear about the School of Transformation?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'paragraph', 'Why are you applying to the School of Transformation?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, min_select, max_select, sort_order)
      values (s.id, 'application', 'checkbox_group',
        'The goal of the school is to "transform lives". If there were some things that you could become completely free of, what would they be?',
        jsonb_build_array(
          'Comparison', 'Insecurity/self worth', 'Materialism', 'Envy/jealousy', 'Anger', 'Anxiety', 'Rebellion',
          'Greed', 'Fear', 'Self-justification', 'Control', 'Manipulation', 'Coarse joking', 'Lying', 'Codependence',
          'Idolatry', 'Pride', 'Unforgiveness', 'Sexual sin', 'Depression', 'Hatred', 'Gluttony', 'Passivity',
          'Same-sex attraction', 'Alcohol', 'Smoking Nicotine', 'Marijuana', 'Narcotics and/or Hallucinogens',
          'Self Harm', 'Other'
        ), true, 3, 5, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'yes_no', 'Have you previously applied to the School of Transformation, or another training school with the Antioch Movement of churches?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'yes_no', 'Have you completed a different ministry training school in the past? (Not affiliated with the Antioch Movement of churches)', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'short_text', 'What is your current church home?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'application', 'yes_no',
        'As a student you will be required to serve as a regular weekend volunteer at [TBD — church name]. Do you currently serve as a weekend volunteer there?',
        null, true, ord)
      returning id into v_volunteer_serve_id;
    ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'application', 'short_text', 'Which role/capacity?', true, v_volunteer_serve_id, 'Yes', ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'application', 'yes_no', 'Have you ever served at another church?', false, v_volunteer_serve_id, 'No', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'application', 'paragraph', 'Do you have any additional comments or clarification about anything you reported here on this questionnaire?', false, ord); ord := ord + 1;

    -- Options list captured from source was cut off at 3 — admin should
    -- confirm the full set of volunteer roles offered via Form Builder.
    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, min_select, max_select, sort_order)
      values (s.id, 'application', 'checkbox_group', 'Choose 3 volunteer roles that interest you',
        '[TBD — confirm this is the complete list of volunteer roles]',
        jsonb_build_array(
          'Hospitality Team (serving coffee and refreshments)',
          'Greeting and Usher team (greeting, welcoming and assisting members and guests)',
          'Worship team (leading others in worship through singing and instrumentation)'
        ), true, 3, 3, ord); ord := ord + 1;

  end loop;

  -- ── Health & Wellness Survey ────────────────────────────────────────────
  for s in select id from school_years where is_active loop
    if exists (select 1 from application_fields where school_year_id = s.id and form_key = 'wellness') then
      continue;
    end if;

    ord := 1;

    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Personal Health & Wellness Survey', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'note',
        'This form provides a framework for our in-person assessment and interview. As a prospective student, we care deeply about your well-being: physical, emotional, mental, relational, and spiritual health. Please take the time to complete this honestly and completely.',
        ord); ord := ord + 1;

    -- Physical Health
    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Physical Health', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have chronic illness or non-seasonal allergies.', false, ord)
      returning id into v_chronic_illness_id; ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'wellness', 'paragraph', 'If so, please explain your chronic illness or non-seasonal allergies.', false, v_chronic_illness_id, 'Yes', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have been diagnosed with a disease, cancer or other significant illness.', false, ord)
      returning id into v_significant_illness_id; ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'wellness', 'paragraph', 'If so, please indicate what medications and the reasons for taking them.', false, v_significant_illness_id, 'Yes', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I am currently taking prescription medications requiring a doctor''s care.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have certain learning disabilities that might impact me during the school year.', false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have handicaps or health conditions that require special care and considerations.', false, ord)
      returning id into v_handicap_id; ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'wellness', 'paragraph', 'If so, please explain your situation and what care or considerations might be required.', false, v_handicap_id, 'Yes', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I often have trouble sleeping.', false, ord)
      returning id into v_trouble_sleeping_id; ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, options, required, show_if_field_id, show_if_value, sort_order)
      values (s.id, 'wellness', 'select', 'How often do you have trouble sleeping?',
        jsonb_build_array('Rarely', 'Sometimes', 'Often', 'Almost every night'),
        true, v_trouble_sleeping_id, 'Yes', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'How would you describe your level of health and fitness?', 'Select all that apply.',
        jsonb_build_array(
          'Sedentary (little or no physical exercise)', 'Moderately active', 'Very active', 'Athletic',
          'Underweight', 'Slightly underweight', 'Average weight', 'Slightly overweight', 'Overweight', 'Obese',
          'I am concerned about my weight', 'I am happy with my body', 'I struggle with self image',
          'I eat a well balanced diet', 'I mostly eat healthy but occasionally indulge',
          'I refrain from all unhealthy foods (junk food, sugars, fast food, etc.)',
          'I am concerned about my diet', 'I am not concerned about my diet',
          'I have certain foods or drinks that I am a little too attached to',
          'I have struggled with, or am currently struggling with, an eating disorder.',
          'I have experienced, or have recently experienced, suicidal ideation.',
          'I hear voices in my head.'
        ), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'paragraph', 'In what ways would you like to see God bring physical transformation to your body?', true, ord); ord := ord + 1;

    -- Mental Health
    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Mental Health', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'Which, if any, of the following symptoms of anxiety do you experience on a regular basis?',
        'Please do not include occasional experiences of the following.',
        jsonb_build_array(
          'Shortness of breath', 'Panic attacks', 'Overwhelming fears', 'Constant worry', 'Biting finger nails',
          'Digestive problems', 'Trouble sleeping', 'Vomiting', 'Excessive sweating',
          'I do not experience any of these symptoms on a regular basis'
        ), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have experienced, or am currently experiencing, periods of depression.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have struggled with, or am currently struggling with, self harm.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have struggled with, or am currently struggling with, an eating disorder.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have experienced, or have recently experienced, suicidal ideation.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I hear voices in my head.', 'This is not referring to "hearing God''s voice".', false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'select', 'How would you rate your overall self esteem?', 'This is not inferring narcissism or self-obsession.',
        jsonb_build_array('1 - I hate who I am', '2', '3', '4 - Most days I am ok with who I am', '5', '6', '7 - I love who I am'),
        true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'Regarding stress — which of the following phrases do you identify with?',
        'We all experience stress.',
        jsonb_build_array(
          'I am concerned about my stress levels.', 'I feel a lot of pressure with all of my responsibilities.',
          'I am often concerned that people are disappointed with me.',
          'I have broken relationships with friends or family members that impair my ability to function.',
          'I am overwhelmed right now.', 'I think that my stress has had a negative impact on my health.',
          'My life is far more challenging than it is peaceful.', 'Sometimes I want to give up.',
          'I have one or more area of my life that seems to be hanging by just a thread (work, friendships, family, school, etc.).',
          'I sometimes verbally lash out when I am at my max (yelling or swearing).',
          'I sometimes physically lash out when I am at my max (throwing, aggression, or hitting).',
          'I am too blessed to be stressed.', 'I avoid negative situations and people because they bring me down.',
          'I find myself trying to self-medicate with food when I am stressed.',
          'I find myself trying to self-medicate by binge watching TV/video games/social media when I am stressed.',
          'I find myself withdrawing from community when I am stressed.', 'I avoid conflict with people.',
          'I just try to keep busy, and believe it will all work out.', 'Other'
        ), false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'paragraph', 'In what ways would you like to see God bring transformation to your mental health?',
        'Anxiety, stress, depression, mental illness, etc.', true, ord); ord := ord + 1;

    -- Sex and Relationships
    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Sex and Relationships', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'wellness', 'select', 'What is your current relationship status?',
        jsonb_build_array('Single', 'Dating', 'Engaged', 'Married'), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'Have you been married before?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'short_text', 'What are your own convictions and beliefs regarding pre-marital and extramarital sexual activity?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'Have you been involved in any premarital or extramarital sexually-active relationships in the past 12 months?', false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'Have you ever conceived a child outside of marriage? (born or unborn)', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'short_text', 'If you did not cover this in the previous section, what are your personal convictions and beliefs regarding pornography and masturbation?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'wellness', 'select', 'When was the last time that you intentionally looked at pornography and/or masturbated?',
        jsonb_build_array(
          'Within the last week', 'Within the last couple of weeks', 'Within the last month', 'A few months ago',
          'Within the past year', 'Over a year ago', 'Over two years ago',
          'I have never struggled with pornography or masturbation'
        ), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'Have you ever been sexually abused or molested?', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'short_text', 'What are your personal beliefs regarding gender and identity?', 'Related to GLBTQ and transgender.', true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I personally experience same sex attraction.', 'Check this box if it applies to you.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have been in, or am currently in, a same-sex relationship or encounter.', 'Check this box if it applies to you.', false, ord); ord := ord + 1;
    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I have been convicted of a sex-related crime.', 'Check this box if this applies to you.', false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'paragraph', 'In what ways would you like to see God bring transformation to your sexual and relational life?', 'Romantic and non-romantic relationships.', true, ord); ord := ord + 1;

    -- Relational Health
    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Relational Health', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'How would you describe your current level of friendships and community?', 'Check all that apply.',
        jsonb_build_array(
          'I have great community around me.', 'I am lonely.', 'I have many good friends in my life.',
          'I have a few close friendships.', 'I have very few friends.',
          'I have at least one friend that I can tell anything to', 'I have no friends.',
          'I have friends that share my same faith and values.', 'Most of my friends do not share my same faith and values.',
          'I am hoping to build deeper friendship and community with people of faith.'
        ), true, ord); ord := ord + 1;

    -- Spiritual Health
    insert into application_fields (school_year_id, form_key, type, label, sort_order)
      values (s.id, 'wellness', 'header', 'Spiritual Health', ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'select', 'How would you best describe your relationship with God?',
        'Choose the one that most resonates. There is not a wrong or right answer.',
        jsonb_build_array(
          'I am far from God', 'I am making my way back to God', 'I am a child of God, secure in His love',
          'I am a christian growing in my faith and walk with Christ',
          'I am trying my best to be a good person, and hope to earn God''s favor', 'I am close to God',
          'I am a saint', 'I am an unworthy sinner in need of God''s mercy',
          'I am strong in my faith, and mostly living in God''s will', 'Jesus is my best friend', 'God is my father',
          'God is mystery', 'Jesus is my shepherd and I hear his voice'
        ), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, required, sort_order)
      values (s.id, 'wellness', 'yes_no', 'I grew up in a religious (controlling or manipulative) environment?', 'Check this box if it applies to you.', false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'Which of the following non-christian spiritual activities or experiences have you engaged in?',
        jsonb_build_array(
          'Out-of-body experiences (astral-projection)', 'Ouija Board', 'Bloody Mary', 'Light-as-a-feather (or other occult game)',
          'Table lifting', 'Magic Eight Ball', 'Spells or Curses', 'Mental telepathy or mental control of others',
          'Automatic writing', 'Trances', 'Spirit Guides', 'Fortune-telling/divination (i.e. tea leaves)', 'Tarot Cards',
          'Levitation', 'Witchcraft/sorcery', 'Satanism', 'Palm Reading', 'Voodoo', 'Astrology/Horoscopes',
          'Hypnosis (amateur or self-induced)', 'Seances (communicating with the dead)', 'Black or White Magic',
          'Dungeons and Dragons', 'Magic Cards', 'Blood pacts or cutting yourself on purpose',
          'Objects of worship/crystals/good luck charms', 'Sexual Spirits', 'Martial arts related devotion to sensei/mysticism',
          'Praying to statues/saints', 'Mary Worship', 'Superstitions', 'Violent video games', 'Horror Movies',
          'Sorcery or occult related video games'
        ), true, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'Which of the following non-christian groups or organizations have you been involved with?',
        jsonb_build_array(
          'New Age (books, objects, seminars, medicine)', 'Mormonism (Latter Day Saints)', 'Jehovah''s Witness (Watchtower)',
          'Free Masons (Masonry)', 'Scientology', 'Transcendental Meditation', 'Yoga', 'Hare Krishna', 'Bahaism',
          'Native American spirit/ancestral worship', 'Islam', 'Hinduism', 'Buddhism', 'None of the above'
        ), false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, help_text, options, required, sort_order)
      values (s.id, 'wellness', 'checkbox_group', 'Check all that apply to you.', 'Related to spiritual health.',
        jsonb_build_array(
          'I wrestle with consistent religious-related shame/guilt.', 'I often have trouble believing that God loves me.',
          'Even though I have been told I am forgiven, I do not feel free from the sins of my past.',
          'I worry whether or not I will go to heaven when I die.'
        ), false, ord); ord := ord + 1;

    insert into application_fields (school_year_id, form_key, type, label, required, sort_order)
      values (s.id, 'wellness', 'paragraph', 'In what ways would you like to see God bring transformation to your spiritual life?', true, ord); ord := ord + 1;

  end loop;
end $$;
