import type { Tool, Profile, MCPConfig, Skill, Template, FastVibeConfig } from './types.js'
import { tools } from './tools.js'
import { profiles, stacks, skills, templates } from './profiles.js'

export class Registry {
  private _tools: Map<string, Tool> = new Map()
  private _profiles: Map<string, Profile> = new Map()
  private _skills: Map<string, Skill> = new Map()
  private _templates: Map<string, Template> = new Map()

  constructor() {
    for (const tool of tools) {
      this._tools.set(tool.id, tool)
    }
    for (const profile of profiles) {
      this._profiles.set(profile.id, profile)
    }
    for (const skill of skills) {
      this._skills.set(skill.id, skill)
    }
    for (const template of templates) {
      this._templates.set(template.id, template)
    }
  }

  get tools(): Tool[] { return Array.from(this._tools.values()) }
  get profiles(): Profile[] { return Array.from(this._profiles.values()) }
  get stacks(): Profile[] { return stacks }
  get skills(): Skill[] { return Array.from(this._skills.values()) }
  get templates(): Template[] { return Array.from(this._templates.values()) }

  getTool(id: string): Tool | undefined { return this._tools.get(id) }
  getProfile(id: string): Profile | undefined { return this._profiles.get(id) }
  getSkill(id: string): Skill | undefined { return this._skills.get(id) }
  getTemplate(id: string): Template | undefined { return this._templates.get(id) }

  getToolsByCategory(category: string): Tool[] {
    return this.tools.filter(t => t.category === category)
  }

  getRecommendedTools(): Tool[] {
    return this.tools.filter(t => t.recommended)
  }

  getProfileTools(profileId: string): Tool[] {
    const profile = this.getProfile(profileId)
    if (!profile) return []
    return profile.tools.map(id => this.getTool(id)).filter(Boolean) as Tool[]
  }

  getProfileSkills(profileId: string): Skill[] {
    const profile = this.getProfile(profileId)
    if (!profile) return []
    return profile.skills.map(id => this.getSkill(id)).filter(Boolean) as Skill[]
  }

  getTemplatesByCategory(category: string): Template[] {
    return this.templates.filter(t => t.category === category)
  }

  getToolsByIds(ids: string[]): Tool[] {
    return ids.map(id => this.getTool(id)).filter(Boolean) as Tool[]
  }

  async fetchRemoteRegistry(url?: string): Promise<void> {
    // Future: fetch from fastvibe.dev/registry
    // For now, all tools are built-in
  }
}

export { tools, profiles, stacks, skills, templates }
export type { Tool, Profile, MCPConfig, Skill, Template, FastVibeConfig }