# Newsbrief

Search recent news, pick the articles you care about, and get a short summary and a sentiment label for each.

## Language

**Article**:
One publisher's copy of a news item, identified by its URL. Syndicated copies of the same item on different sites are different Articles.
_Avoid_: Story (reserved for the grouping below), post, item

**Analysis**:
The Summary and Sentiment one model produced for one Article, recorded with that model's name. Each Article has at most one, and it is never redone.
_Avoid_: Saved item, brief, result

**Summary**:
The two-to-three-sentence account of an Article; one part of its Analysis.

**Story** _(not modeled yet)_:
The set of Articles that report the same news item, such as one press release syndicated across several sites.
