class HealthController < ApplicationController
  def index
    render json: {
      status: "healthy",
      framework: "Ruby on Rails",
      service: "hackathon-ruby-rails",
      timestamp: Time.now.utc.iso8601
    }
  end
end
