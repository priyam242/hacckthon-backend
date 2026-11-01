module Api
  module V1
    class AiController < ApplicationController
      before_action :authenticate_user!

      def generate
        prompt = params[:prompt]
        if prompt.blank?
          return render_problem(status: :bad_request, title: "Validation Error", detail: "Prompt field is required")
        end

        render json: {
          prompt: prompt,
          response: "[Rails AI Engine] Response generated for query: '#{prompt}'. Ready for pitch.",
          model: "rails-hackathon-engine"
        }
      end
    end
  end
end
